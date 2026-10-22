package expo.modules.notificationlistener

import android.app.Notification
import android.content.pm.ApplicationInfo
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

class WalletNotificationListenerService : NotificationListenerService() {
  companion object {
    // Counts only; reset when the native process restarts. No notification payloads.
    internal val fixtureDuplicateChecks = AtomicLong()
    internal val fixtureDuplicateFailures = AtomicLong()
  }
  private val executor = ThreadPoolExecutor(
    1, 1, 0L, TimeUnit.MILLISECONDS, ArrayBlockingQueue<Runnable>(64),
    { task -> Thread(task, "wallet-notification-capture") }, ThreadPoolExecutor.AbortPolicy()
  )
  private val preferences by lazy { CapturePreferences(applicationContext) }
  private val dispatcher by lazy {
    NotificationCaptureDispatcher(CapturePreferences.LOCK, { preferences.read() }, executor,
      { CapturePreferences.revision })
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    try {
      var repeatFixtureDelivery = false
      // The worker checks authorization before this closure can access any content.
      dispatcher.capture(sbn.packageName, {
        val extras = sbn.notification.extras
        repeatFixtureDelivery = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0 &&
          sbn.packageName == CaptureAuthorization.FIXTURE_PACKAGE &&
          extras?.getBoolean(CaptureAuthorization.FIXTURE_DUPLICATE_EXTRA, false) == true
        InboxCapture(
          source = sbn.packageName,
          androidKey = sbn.key,
          androidId = sbn.id,
          androidTag = sbn.tag,
          androidUser = sbn.user.toString(),
          postedAt = sbn.postTime,
          title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
          text = (extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras?.getCharSequence(Notification.EXTRA_TEXT))?.toString()
        )
      }, persist@ { capture ->
        // Do not persist OTPs, passwords or credentials, even from explicitly authorized apps.
        if (!NotificationContentPrivacy.allows(capture.title, capture.text)) return@persist
        NotificationInboxStore(applicationContext).use { store ->
          val id = store.insert(capture)
          if (repeatFixtureDelivery) {
            try {
              // Replay the SAME Android identity/time/content, not a newly posted notification.
              check(store.insert(capture) == id) { "Fixture deduplication failed" }
              fixtureDuplicateChecks.incrementAndGet()
            } catch (error: Exception) {
              fixtureDuplicateFailures.incrementAndGet()
              throw error
            }
          }
        }
      })
    } catch (_: Exception) {
      // No plaintext fallback and no sensitive logging.
    }
  }

  override fun onDestroy() {
    executor.shutdown() // Already accepted events finish on the serial native worker.
    super.onDestroy()
  }
}
