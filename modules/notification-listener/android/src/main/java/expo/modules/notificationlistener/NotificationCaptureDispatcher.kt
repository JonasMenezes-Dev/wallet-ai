package expo.modules.notificationlistener

import java.util.concurrent.Executor

internal class NotificationCaptureDispatcher(
  private val lock: Any,
  private val authorization: () -> CaptureAuthorization,
  private val executor: Executor,
  private val authorizationRevision: () -> Long
) {
  fun <T> capture(source: String, readContent: () -> T, persist: (T) -> Unit) {
    try {
      val revision = authorizationRevision()
      executor.execute {
        try {
          // Preference updates use this same lock. Revocation cannot race a write.
          synchronized(lock) {
            if (revision != authorizationRevision() || !authorization().allows(source)) return@execute
            val content = readContent()
            if (revision != authorizationRevision() || !authorization().allows(source)) return@execute
            persist(content)
          }
        } catch (_: Exception) {
          // Fail closed. Never log the notification or exception message.
        }
      }
    } catch (_: Exception) {
      // A full or stopped executor must not crash the Android callback.
    }
  }
}
