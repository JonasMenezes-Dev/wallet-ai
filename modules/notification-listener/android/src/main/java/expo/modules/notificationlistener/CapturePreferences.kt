package expo.modules.notificationlistener

import android.content.Context
import android.content.pm.ApplicationInfo
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.atomic.AtomicLong

/** Native authorization only: no plaintext fallback or legacy preference import. */
internal class CapturePreferences(context: Context) {
  private val debuggable = (context.applicationContext.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
  private val file = AtomicFile(File(context.applicationContext.noBackupFilesDir, "notification-capture-preferences.v1"))
  private val crypto = InboxCrypto("wallet_capture_preferences_aes_v1", "wallet_capture_preferences_hmac_v1")

  fun read(): CaptureAuthorization = synchronized(LOCK) {
    try {
      val ciphertext = file.openRead().use { input ->
        val buffer = ByteArray(65537)
        var size = 0
        while (size < buffer.size) {
          val count = input.read(buffer, size, buffer.size - size)
          if (count < 0) break
          size += count
        }
        require(size <= 65536)
        buffer.copyOf(size)
      }
      val json = JSONObject(crypto.decrypt(ciphertext, AAD))
      require(json.getInt("version") == 1)
      val enabled = json.get("enabled") as? Boolean ?: error("Invalid capture preference")
      val packages = json.getJSONArray("authorizedPackages")
      require(packages.length() <= 128)
      // Validate the persisted shape, then enforce the actual native runtime's debug restriction.
      CaptureAuthorization.validated(enabled, (0 until packages.length()).map {
        packages.get(it) as? String ?: error("Invalid application identifier")
      }, debuggable = true).forRuntime(debuggable)
    } catch (_: Exception) {
      CaptureAuthorization()
    }
  }

  fun update(enabled: Boolean, packages: List<String>): Boolean = synchronized(LOCK) {
    // Events waiting before a consent change must never be captured retroactively.
    REVISION.incrementAndGet()
    var output: FileOutputStream? = null
    try {
      val policy = CaptureAuthorization.validated(enabled, packages, debuggable)
      // Lost keys for an existing file are never silently replaced.
      crypto.ensureAvailable(!file.baseFile.exists() && !File(file.baseFile.path + ".bak").exists())
      val json = JSONObject().put("version", 1).put("enabled", policy.enabled)
        .put("authorizedPackages", JSONArray(policy.authorizedPackages.sorted()))
      val ciphertext = crypto.encrypt(json.toString(), AAD)
      output = file.startWrite()
      output.write(ciphertext)
      file.finishWrite(output)
      check(read() == policy) { "Capture authorization was not persisted" }
      true
    } catch (_: Exception) {
      if (output != null) {
        try { file.failWrite(output) } catch (_: Exception) { /* Keep capture fail closed. */ }
      }
      false
    }
  }

  companion object {
    // Shared by the service and every bridge instance within the native process.
    internal val LOCK = Any()
    private val REVISION = AtomicLong()
    internal val revision: Long get() = REVISION.get()
    private const val AAD = "wallet:capture-authorization:v1"
  }
}
