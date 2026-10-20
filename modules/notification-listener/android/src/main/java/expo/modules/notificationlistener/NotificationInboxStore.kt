package expo.modules.notificationlistener

import android.content.Context
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

/** Independent native queue. No listener hookup, JS bridge or financial writes. */
class NotificationInboxStore(context: Context, private val clock: () -> Long = { System.currentTimeMillis() }) : AutoCloseable {
  private val app = context.applicationContext
  private val crypto = InboxCrypto()
  private val statements = app.assets.open("notification-inbox-v1.json").bufferedReader().use { JSONObject(it.readText()) }
  private val helper = object : SQLiteOpenHelper(app, File(app.noBackupFilesDir, "notification-inbox.db").absolutePath, null, 1) {
    override fun onConfigure(db: SQLiteDatabase) {
      db.setForeignKeyConstraintsEnabled(true)
      db.execSQL("PRAGMA synchronous = FULL")
    }
    override fun onCreate(db: SQLiteDatabase) {
      val schema = statements.getJSONArray("schema")
      for (i in 0 until schema.length()) db.execSQL(schema.getString(i))
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
      error("Unsupported inbox migration") // Never drop a queue on an unknown upgrade.
    }
  }.apply { setWriteAheadLoggingEnabled(true) }

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
      db.rawQuery(sql("byId"), arrayOf(localId)).use { if (it.moveToFirst()) return@transaction localId }
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

  override fun close() = helper.close()

  companion object {
    private const val RAW_TTL = 24L * 60 * 60 * 1000
    private const val STRUCTURED_TTL = 30L * RAW_TTL
  }
}
