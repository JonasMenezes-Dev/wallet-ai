package expo.modules.notificationlistener

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import org.json.JSONArray
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {
  companion object {
    private const val PREFS = "wallet_notification_listener"
    private const val KEY_EVENTS = "captured_events"
    private const val CHANNEL_ID = "wallet_expense_recorded"
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
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      null
    }

    Function("notifyExpenseRecorded") { amount: Double, category: String ->
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT >= 33 &&
        context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
      ) return@Function false

      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        manager.createNotificationChannel(
          NotificationChannel(
            CHANNEL_ID,
            "Confirmações de gastos",
            NotificationManager.IMPORTANCE_DEFAULT
          ).apply { description = "Confirma quando o Wallet registra um gasto por notificação bancária." }
        )
      }

      val amountText = java.text.NumberFormat.getCurrencyInstance(java.util.Locale("pt", "BR")).format(amount)
      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(context, CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(context)
      }
      builder
        .setSmallIcon(android.R.drawable.ic_menu_info_details)
        .setContentTitle("Gasto registrado com sucesso!")
        .setContentText("O Wallet anotou $amountText na categoria $category.")
        .setStyle(Notification.BigTextStyle().bigText("O Wallet anotou uma despesa de $amountText na categoria $category."))
        .setAutoCancel(true)
      manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), builder.build())
      true
    }

    Function("getCapturedNotifications") {
      val context = appContext.reactContext ?: return@Function emptyList<Map<String, Any>>()
      val json = try {
        JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_EVENTS, "[]"))
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
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
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
