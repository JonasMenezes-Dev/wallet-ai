package expo.modules.notificationlistener

import android.content.Context
import android.content.pm.ApplicationInfo
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.Normalizer
import java.util.UUID

enum class InboxState(val value: String) {
  RECEIVED("received"), PENDING("pending"), CONFIRMED("confirmed"), IGNORED("ignored"), ERROR("error")
}

data class InboxStructuredData(
  val amountCents: Long? = null,
  val operation: String? = null,
  val direction: String? = null,
  val occurredAt: String? = null,
  val description: String? = null,
  val parserVersion: Int? = null
) {
  internal fun json(): String {
    require(amountCents == null || amountCents in 1..9007199254740991L)
    require(operation == null || operation in setOf("pix", "debit_purchase", "credit_purchase", "transfer", "own_account_transfer", "payment", "receipt"))
    require(direction == null || direction in setOf("incoming", "outgoing", "internal"))
    require(occurredAt == null || occurredAt.length <= 40)
    require(parserVersion == null || parserVersion > 0)
    return JSONObject().put("amountCents", amountCents).put("operation", operation)
      .put("direction", direction).put("occurredAt", occurredAt)
      .put("description", description?.take(160)).put("parserVersion", parserVersion).toString()
  }
}

data class InboxCapture(
  val source: String,
  val androidKey: String? = null,
  val androidId: Int? = null,
  val androidTag: String? = null,
  val androidUser: String? = null,
  val postedAt: Long? = null,
  val title: String? = null,
  val text: String? = null,
  val structured: InboxStructuredData? = null
)

data class InboxEvent(
  val localId: String,
  val source: String,
  val postedAt: Long?,
  val receivedAt: Long,
  val fingerprint: String,
  val state: InboxState,
  val attempts: Int,
  val nextAttemptAt: Long?,
  val leaseToken: String?,
  val leaseUntil: Long?,
  val errorCode: String?,
  val confirmationReference: String?,
  // JSON is decrypted only in memory. Raw payload declares whether text was truncated.
  val androidIdentity: String?,
  val rawPayload: String?,
  val structuredData: String?
)

/** Native encrypted queue; no financial writes. */
class NotificationInboxStore(context: Context, private val clock: () -> Long = { System.currentTimeMillis() }) : AutoCloseable {
  private val app = context.applicationContext
  private val crypto = InboxCrypto()
  private val statements = app.assets.open("notification-inbox-v1.json").bufferedReader().use { JSONObject(it.readText()) }
  private val helper = object : SQLiteOpenHelper(app, File(app.noBackupFilesDir, "notification-inbox.db").absolutePath, null, 2) {
    override fun onConfigure(db: SQLiteDatabase) {
      db.setForeignKeyConstraintsEnabled(true)
      db.execSQL("PRAGMA synchronous = FULL")
    }
    override fun onCreate(db: SQLiteDatabase) {
      val schema = statements.getJSONArray("schema")
      for (i in 0 until schema.length()) db.execSQL(schema.getString(i))
      installConfirmationSchema(db)
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
      check(oldVersion == 1 && newVersion == 2) { "Unsupported inbox migration" }
      installConfirmationSchema(db)
    }
  }.apply { setWriteAheadLoggingEnabled(true) }

  private fun installConfirmationSchema(db: SQLiteDatabase) {
    val schema = statements.getJSONArray("confirmationSchema")
    for (i in 0 until schema.length()) db.execSQL(schema.getString(i))
    db.execSQL("INSERT OR IGNORE INTO inbox_metadata(id,namespace) VALUES(1,?)", arrayOf(UUID.randomUUID().toString()))
  }

  private fun eventKey(db: SQLiteDatabase, id: String): String = db.rawQuery("SELECT namespace FROM inbox_metadata WHERE id=1", null).use {
    check(it.moveToFirst()) { "Inbox identity unavailable" }
    "${it.getString(0)}:$id"
  }

  private fun sql(name: String) = statements.getString(name)
  private fun execute(db: SQLiteDatabase, name: String, vararg args: Any?): Int = db.compileStatement(sql(name)).use { stmt ->
    args.forEachIndexed { index, value ->
      when (value) {
        null -> stmt.bindNull(index + 1)
        is ByteArray -> stmt.bindBlob(index + 1, value)
        is Number -> stmt.bindLong(index + 1, value.toLong())
        else -> stmt.bindString(index + 1, value.toString())
      }
    }
    stmt.executeUpdateDelete()
  }

  private fun <T> transaction(block: (SQLiteDatabase) -> T): T {
    val db = helper.writableDatabase
    db.beginTransaction()
    try { val result = block(db); db.setTransactionSuccessful(); return result }
    finally { db.endTransaction() }
  }

  private fun normalize(value: String) = Normalizer.normalize(value, Normalizer.Form.NFKD)
    .replace(Regex("\\p{M}+"), "").lowercase(java.util.Locale.ROOT).replace(Regex("\\s+"), " ").trim()

  fun insert(input: InboxCapture): String {
    require(input.source.isNotBlank() && input.source.length <= 255)
    require(input.postedAt == null || input.postedAt >= 0)
    maintain()
    val empty = helper.readableDatabase.rawQuery("SELECT 1 FROM inbox_events LIMIT 1", null).use { !it.moveToFirst() }
    // Never silently rotate lost keys: doing so would invalidate persistent deduplication.
    crypto.ensureAvailable(empty)
    val now = clock()
    val localId = UUID.randomUUID().toString()
    val identity = JSONObject().put("key", input.androidKey).put("id", input.androidId)
      .put("tag", input.androidTag).put("user", input.androidUser).toString()
    val fingerprint = crypto.fingerprint(JSONArray().put(normalize(input.title.orEmpty())).put(normalize(input.text.orEmpty())).toString())
    // A reused Android id alone is NOT a stable event identity. Missing evidence means no dedup.
    val identityKey = if (input.postedAt != null && (!input.androidKey.isNullOrBlank() || input.androidId != null)) {
      crypto.fingerprint(JSONArray().put(input.source).put(identity).put(input.postedAt).put(fingerprint).toString())
    } else null
    val raw = if (input.title != null || input.text != null) JSONObject()
      .put("title", input.title?.take(160)).put("text", input.text?.take(500))
      .put("truncated", (input.title?.length ?: 0) > 160 || (input.text?.length ?: 0) > 500).toString() else null
    val rawCipher = raw?.let { crypto.encrypt(it, "$localId:raw:v1") }
    val structured = input.structured?.json()?.let { crypto.encrypt(it, "$localId:structured:v1") }
    val identityCipher = crypto.encrypt(identity, "$localId:identity:v1")
    return transaction { db ->
      db.execSQL(sql("insert"), arrayOf(localId, input.source, input.postedAt, now, identityKey, fingerprint,
        identityCipher, rawCipher, structured, now + RAW_TTL, now + STRUCTURED_TTL, now))
      // An ignored UUID collision must never be mistaken for a successful new capture.
      db.rawQuery("SELECT changes()", null).use { check(it.moveToFirst()); if (it.getInt(0) == 1) return@transaction localId }
      check(identityKey != null) { "Inbox insert rejected" }
      db.rawQuery(sql("existing"), arrayOf(identityKey)).use {
        check(it.moveToFirst()) { "Inbox insert rejected" }
        it.getString(0)
      }
    }
  }

  fun list(state: InboxState, limit: Int = 100): List<InboxEvent> {
    require(limit in 1..500)
    maintain()
    return helper.readableDatabase.rawQuery(sql("list"), arrayOf(state.value, limit.toString())).use { cursor ->
      buildList { while (cursor.moveToNext()) add(event(cursor)) }
    }
  }

  fun claimNext(state: InboxState = InboxState.RECEIVED, leaseMillis: Long = 120000): InboxEvent? {
    require(state in setOf(InboxState.RECEIVED, InboxState.ERROR))
    require(leaseMillis in 1000L..600000L)
    maintain()
    val now = clock()
    val token = UUID.randomUUID().toString()
    return transaction { db ->
      if (execute(db, "claim", token, now + leaseMillis, now, state.value, now, now) == 0) null
      else db.rawQuery(sql("claimed"), arrayOf(token)).use { check(it.moveToFirst()); event(it) }
    }
  }

  fun updateState(localId: String, expected: InboxState, next: InboxState, leaseToken: String? = null,
    structured: InboxStructuredData? = null, nextAttemptAt: Long? = null, confirmationReference: String? = null): Boolean {
    val allowed = when (expected) {
      InboxState.RECEIVED -> setOf(InboxState.PENDING, InboxState.IGNORED, InboxState.ERROR)
      InboxState.PENDING -> setOf(InboxState.CONFIRMED, InboxState.IGNORED, InboxState.ERROR)
      InboxState.ERROR -> setOf(InboxState.RECEIVED, InboxState.PENDING, InboxState.IGNORED, InboxState.ERROR)
      else -> emptySet()
    }
    require(next in allowed)
    require(next != InboxState.CONFIRMED || !confirmationReference.isNullOrBlank())
    require(confirmationReference == null || confirmationReference.length <= 128)
    require(nextAttemptAt == null || next == InboxState.ERROR)
    val now = clock()
    val cipher = structured?.json()?.let { crypto.encrypt(it, "$localId:structured:v1") }
    return execute(helper.writableDatabase, "update", next.value, cipher,
      if (next == InboxState.ERROR) "processing_failed" else null, nextAttemptAt, confirmationReference,
      next.value, now, localId, expected.value, now, leaseToken, leaseToken, now) == 1
  }

  /** Expired work is retried with a fresh token; stale workers cannot acknowledge it. */
  fun maintain(): Int = transaction { db ->
    val now = clock()
    execute(db, "purgeRaw", now)
    execute(db, "purgeStructured", now, now)
    execute(db, "recover", now, now, now)
  }

  private fun event(cursor: Cursor): InboxEvent {
    fun text(name: String): String? = cursor.getColumnIndexOrThrow(name).let { if (cursor.isNull(it)) null else cursor.getString(it) }
    fun number(name: String): Long? = cursor.getColumnIndexOrThrow(name).let { if (cursor.isNull(it)) null else cursor.getLong(it) }
    val id = text("local_id")!!
    val now = clock()
    fun decrypt(column: String, label: String, expires: Long): String? {
      val index = cursor.getColumnIndexOrThrow(column)
      if (cursor.isNull(index) || expires <= now) return null
      return crypto.decrypt(cursor.getBlob(index), "$id:$label:v1")
    }
    val state = InboxState.entries.first { it.value == text("state") }
    var failed = false
    val payloads = try {
      Triple(decrypt("android_identity_cipher", "identity", number("structured_expires_at")!!),
        decrypt("raw_cipher", "raw", number("raw_expires_at")!!),
        decrypt("structured_cipher", "structured", number("structured_expires_at")!!))
    } catch (error: Exception) {
      if (error !is java.security.GeneralSecurityException && error !is IllegalArgumentException) throw error
      failed = true
      val changed = execute(helper.writableDatabase, "decryptionError", now, id, state.value,
        text("lease_token"), number("revision"))
      if (changed == 0 && state !in setOf(InboxState.CONFIRMED, InboxState.IGNORED)) {
        throw java.util.ConcurrentModificationException("Inbox event changed during read")
      }
      Triple(null, null, null)
    }
    val activeFailure = failed && state !in setOf(InboxState.CONFIRMED, InboxState.IGNORED)
    return InboxEvent(id, text("source")!!, number("posted_at"), number("received_at")!!, text("fingerprint")!!,
      if (activeFailure) InboxState.ERROR else state, number("attempts")!!.toInt(), number("next_attempt_at"),
      if (activeFailure) null else text("lease_token"), if (activeFailure) null else number("lease_until"),
      if (activeFailure) "decryption_failed" else text("error_code"), text("confirmation_reference"),
      payloads.first, payloads.second, payloads.third)
  }

  /** Explicit application query: no maintenance, raw decryption or persistent writes. */
  internal fun listReview(limit: Int, offset: Int): List<Map<String, Any?>> {
    require(limit in 1..100 && offset in 0..100000)
    return helper.readableDatabase.rawQuery(sql("reviewList"), arrayOf(clock().toString(), limit.toString(), offset.toString())).use { cursor ->
      buildList { while (cursor.moveToNext()) add(reviewItem(cursor, false)) }
    }
  }

  internal fun reserveReview(localId: String, readContent: Boolean): Map<String, Any?>? {
    require(localId.isNotBlank() && localId.length <= 128)
    val token = UUID.randomUUID().toString()
    return transaction { db ->
      val now = clock()
      if (execute(db, "reviewReserve", token, now + 120000, now, localId, now, now) == 0) null
      else db.rawQuery(sql("byId"), arrayOf(localId)).use { cursor ->
        check(cursor.moveToFirst())
        val item = reviewItem(cursor, true, readContent)
        if (clock() >= now + 120000) null else item
      }
    }
  }

  /** Null interpretation reports a failure: retain all ciphertext and release only this live lease. */
  internal fun completeReview(localId: String, token: String, interpretation: String?): Boolean {
    require(localId.isNotBlank() && localId.length <= 128 && token.isNotBlank() && token.length <= 128)
    if (interpretation == null) {
      return transaction { db ->
        val now = clock()
        execute(db, "reviewFail", now, localId, token, now, now) == 1
      }
    }
    val clean = validateReviewInterpretation(interpretation)
    val cipher = crypto.encrypt(clean, "$localId:structured:v1")
    return transaction { db ->
      val now = clock() // Acquire the writer lock before checking expiry; cryptography may be slow.
      execute(db, "reviewFinish", cipher, now, localId, token, now, now) == 1
    }
  }

  internal fun discardReview(localId: String, token: String): Boolean {
    require(localId.isNotBlank() && localId.length <= 128 && token.isNotBlank() && token.length <= 128)
    return transaction { db ->
      val now = clock()
      execute(db, "reviewDiscard", now, localId, token, now, now) == 1
    }
  }

  /** Durable encrypted intent outlives review leases; there is deliberately no automatic abort. */
  internal fun beginConfirmation(localId: String, token: String, request: String): Map<String, Any?> = transaction { db ->
    require(localId.length in 1..128 && token.length in 1..128 && request.length in 1..4096)
    val data = JSONObject(request)
    require(data.optString("kind") in setOf("income", "expense", "internal_transfer"))
    val key = eventKey(db, localId)
    val existing = confirmation(localId)
    if (existing != null) {
      check(existing["requestJson"] == request) { "Confirmation data conflict" }
      existing
    } else {
      val cipher = crypto.encrypt(request, "$key:confirmation:v1")
      val now = clock()
      check(execute(db, "confirmationBegin", localId, key, cipher, now, localId, token, now, now) == 1) { "Event unavailable" }
      execute(db, "confirmationDetachLease", localId)
      checkNotNull(confirmation(localId))
    }
  }

  internal fun confirmation(localId: String): Map<String, Any?>? = helper.readableDatabase.rawQuery(sql("confirmationById"), arrayOf(localId)).use {
    if (!it.moveToFirst()) null else {
      val key = it.getString(1)
      mapOf("localId" to it.getString(0), "eventKey" to key,
        "requestJson" to crypto.decrypt(it.getBlob(2), "$key:confirmation:v1"),
        "reference" to if (it.isNull(3)) null else it.getString(3))
    }
  }

  /** Metadata only: recovery consults the financial receipt before decrypting approved fields. */
  internal fun pendingConfirmations(): List<Map<String, String>> = helper.readableDatabase.rawQuery(sql("confirmationPending"), null).use {
    buildList { while (it.moveToNext()) add(mapOf("localId" to it.getString(0), "eventKey" to it.getString(1))) }
  }

  internal fun finishConfirmation(localId: String, key: String, request: String, reference: String): Boolean = transaction { db ->
    require(reference.length in 1..128)
    val intent = confirmation(localId) ?: return@transaction false
    check(intent["eventKey"] == key && intent["requestJson"] == request) { "Confirmation data conflict" }
    val prior = intent["reference"] as? String
    if (prior != null) {
      check(prior == reference) { "Confirmation reference conflict" }
      true
    } else {
      check(execute(db, "confirmationFinish", reference, clock(), localId) == 1) { "Event unavailable" }
      check(execute(db, "confirmationAcknowledge", reference, localId) == 1)
      true
    }
  }

  private fun validateReviewInterpretation(value: String): String {
    require(value.length <= 4096)
    val json = JSONObject(value)
    fun text(name: String): String? {
      val field = json.opt(name)
      require(field == null || field == JSONObject.NULL || field is String)
      return field as? String
    }
    val status = text("status")
    val reason = text("reason")
    val operation = text("operation")
    val direction = text("direction")
    val date = text("date")
    val time = text("time")
    val dateSource = text("dateSource")
    val rawAmount = json.opt("amountCents")
    val amount = if (rawAmount == null || rawAmount == JSONObject.NULL) null else {
      require(rawAmount is Number && rawAmount.toDouble().isFinite())
      val number = rawAmount.toLong()
      require(number in 1..9007199254740991L && number.toDouble() == rawAmount.toDouble())
      number
    }
    require(status in setOf("recognized", "pending", "ignored"))
    require(reason == null || (reason.length <= 64 && Regex("[a-z_]+").matches(reason)))
    require(time == null || Regex("(?:[01][0-9]|2[0-3]):[0-5][0-9]").matches(time))
    require(dateSource == null || dateSource in setOf("message", "notification"))
    // Reuse native validation of money, operation, direction and date length.
    InboxStructuredData(amountCents = amount, operation = operation, direction = direction, occurredAt = date).json()
    require(status != "recognized" || (amount != null && operation != null && direction != null))
    return JSONObject().put("status", status).put("reason", reason ?: JSONObject.NULL)
      .put("amountCents", amount ?: JSONObject.NULL).put("operation", operation ?: JSONObject.NULL)
      .put("direction", direction ?: JSONObject.NULL).put("date", date ?: JSONObject.NULL)
      .put("time", time ?: JSONObject.NULL).put("dateSource", dateSource ?: JSONObject.NULL).toString()
  }

  /** No Android identity, fingerprint or confirmation references cross the review bridge. */
  private fun reviewItem(cursor: Cursor, reserved: Boolean, readContent: Boolean = true): Map<String, Any?> {
    val id = cursor.getString(cursor.getColumnIndexOrThrow("local_id"))
    val now = clock()
    fun number(name: String): Long? = cursor.getColumnIndexOrThrow(name).let { if (cursor.isNull(it)) null else cursor.getLong(it) }
    var readError = false
    fun decrypt(column: String, label: String, expires: Long): String? {
      if (expires <= now) return null
      val index = cursor.getColumnIndexOrThrow(column)
      if (cursor.isNull(index)) return null
      return try { crypto.decrypt(cursor.getBlob(index), "$id:$label:v1") }
      catch (_: Exception) { readError = true; null }
    }
    val summary = if (readContent) decrypt("structured_cipher", "structured", number("structured_expires_at")!!) else null
    val raw = if (reserved && readContent) decrypt("raw_cipher", "raw", number("raw_expires_at")!!) else null
    return mutableMapOf<String, Any?>(
      "localId" to id, "eventKey" to eventKey(helper.readableDatabase, id),
      "confirmationPending" to helper.readableDatabase.rawQuery("SELECT 1 FROM inbox_confirmation_intents WHERE local_id=? AND reference IS NULL", arrayOf(id)).use { it.moveToFirst() },
      "source" to cursor.getString(cursor.getColumnIndexOrThrow("source")),
      "state" to cursor.getString(cursor.getColumnIndexOrThrow("state")),
      "postedAt" to number("posted_at"), "receivedAt" to number("received_at"),
      "busy" to ((number("lease_until") ?: 0) > now), "summary" to summary, "readError" to readError
    ).apply {
      if (reserved) {
        put("leaseToken", cursor.getString(cursor.getColumnIndexOrThrow("lease_token")))
        put("rawPayload", raw)
      }
    }
  }

  /** Debug-only aggregate for the fixture source. Never decrypts or returns event content. */
  internal fun developmentFixtureCounts(): Map<String, Long> {
    check((app.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) { "Development diagnostics unavailable" }
    val counts = InboxState.entries.associate { it.value to 0L }.toMutableMap()
    helper.readableDatabase.rawQuery(
      "SELECT state, COUNT(*) FROM inbox_events WHERE source = ? GROUP BY state",
      arrayOf(CaptureAuthorization.FIXTURE_PACKAGE)
    ).use { cursor ->
      while (cursor.moveToNext()) counts[cursor.getString(0)] = cursor.getLong(1)
    }
    return counts
  }

  override fun close() = helper.close()

  companion object {
    private const val RAW_TTL = 24L * 60 * 60 * 1000
    private const val STRUCTURED_TTL = 30L * RAW_TTL
  }
}
