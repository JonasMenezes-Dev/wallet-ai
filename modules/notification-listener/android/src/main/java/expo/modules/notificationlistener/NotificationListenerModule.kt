package expo.modules.notificationlistener

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.service.notification.NotificationListenerService
import org.json.JSONArray
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {
  companion object {
    private const val PREFS = "wallet_notification_listener"
    private const val KEY_EVENTS = "captured_events"
  }

  override fun definition() = ModuleDefinition {
    Name("WalletNotificationListener")

    Function("hasPermission") {
      val context = appContext.reactContext ?: return@Function false
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners"
      ) ?: return@Function false
      val component = ComponentName(context, WalletNotificationListenerService::class.java)
      enabled.split(":").any { it.equals(component.flattenToString(), ignoreCase = true) }
    }

    Function("openSettings") {
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("getCapturedNotifications") {
      val context = appContext.reactContext ?: return@Function emptyList<Map<String, Any>>()
      val json = try {
        JSONArray(context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).getString(KEY_EVENTS, "[]"))
      } catch (_: Exception) { JSONArray() }
      (0 until json.length()).mapNotNull { index ->
        val item = json.optJSONObject(index) ?: return@mapNotNull null
        mapOf(
          "key" to item.optString("key"),
          "title" to item.optString("title"),
          "text" to item.optString("text"),
          "packageName" to item.optString("packageName"),
          "postedAt" to item.optLong("postedAt")
        )
      }
    }

    Function("removeCapturedNotification") { key: String ->
      val context = appContext.reactContext ?: return@Function false
      val prefs = context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)
      val current = try { JSONArray(prefs.getString(KEY_EVENTS, "[]")) } catch (_: Exception) { JSONArray() }
      val updated = JSONArray()
      var removed = false
      for (index in 0 until current.length()) {
        val item = current.optJSONObject(index) ?: continue
        if (item.optString("key") == key) removed = true else updated.put(item)
      }
      prefs.edit().putString(KEY_EVENTS, updated.toString()).apply()
      removed
    }
  }
}
