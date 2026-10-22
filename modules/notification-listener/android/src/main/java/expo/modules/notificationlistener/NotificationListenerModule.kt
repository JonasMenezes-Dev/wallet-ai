package expo.modules.notificationlistener

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.ActivityManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.UserManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {
  companion object {
    private const val CHANNEL_ID = "wallet_expense_recorded"
  }

  private fun debuggable(context: Context) = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

  private fun captureSupported(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q && activityManager.isLowRamDevice) return false
    val userManager = context.getSystemService(Context.USER_SERVICE) as UserManager
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.N || !userManager.isManagedProfile
  }

  private fun notificationAccessGranted(context: Context): Boolean {
    val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
    val component = ComponentName(context, WalletNotificationListenerService::class.java)
    return enabled.split(":").any { ComponentName.unflattenFromString(it) == component }
  }

  @Suppress("DEPRECATION")
  private fun installedBanks(context: Context): List<Map<String, String>> {
    val catalog = if (debuggable(context)) SupportedNotificationApps.catalog +
      (CaptureAuthorization.FIXTURE_PACKAGE to "Wallet AI · notificações fictícias") else SupportedNotificationApps.catalog
    return catalog.mapNotNull { (pkg, name) ->
      try {
        if (context.packageManager.getApplicationInfo(pkg, 0).enabled) mapOf("name" to name, "packageName" to pkg) else null
      } catch (_: PackageManager.NameNotFoundException) { null }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("WalletNotificationListener")

    // In-process application queries only. Backlog access does not depend on capture permission.
    AsyncFunction("listNotificationReview") { limit: Int, offset: Int ->
      val context = appContext.reactContext ?: error("Application unavailable")
      NotificationInboxStore(context).use { it.listReview(limit, offset) }
    }
    AsyncFunction("reserveNotificationReview") { localId: String, readContent: Boolean ->
      val context = appContext.reactContext ?: error("Application unavailable")
      NotificationInboxStore(context).use { it.reserveReview(localId, readContent) }
    }
    AsyncFunction("completeNotificationReview") { localId: String, token: String, interpretation: String? ->
      val context = appContext.reactContext ?: error("Application unavailable")
      NotificationInboxStore(context).use { it.completeReview(localId, token, interpretation) }
    }
    AsyncFunction("discardNotificationReview") { localId: String, token: String ->
      val context = appContext.reactContext ?: error("Application unavailable")
      NotificationInboxStore(context).use { it.discardReview(localId, token) }
    }

    AsyncFunction("getDevelopmentCaptureDiagnostics") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      if (!debuggable(context)) return@AsyncFunction null
      NotificationInboxStore(context).use { store ->
        mapOf(
          "states" to store.developmentFixtureCounts(),
          "duplicateChecks" to WalletNotificationListenerService.fixtureDuplicateChecks.get(),
          "duplicateFailures" to WalletNotificationListenerService.fixtureDuplicateFailures.get()
        )
      }
    }

    AsyncFunction("beginNotificationConfirmation") { localId: String, token: String, request: String ->
      val context = appContext.reactContext ?: error("Application unavailable")
      NotificationInboxStore(context).use { it.beginConfirmation(localId, token, request) }
    }
    AsyncFunction("getNotificationConfirmation") { localId: String ->
      val context = appContext.reactContext ?: error("Application unavailable")
      NotificationInboxStore(context).use { it.confirmation(localId) }
    }
    AsyncFunction("listPendingNotificationConfirmations") {
      val context = appContext.reactContext ?: error("Application unavailable")
      NotificationInboxStore(context).use { it.pendingConfirmations() }
    }
    AsyncFunction("finishNotificationConfirmation") { localId: String, key: String, request: String, reference: String ->
      val context = appContext.reactContext ?: error("Application unavailable")
      NotificationInboxStore(context).use { it.finishConfirmation(localId, key, request, reference) }
    }

    Function("isCaptureSupported") {
      val context = appContext.reactContext ?: return@Function false
      captureSupported(context)
    }

    AsyncFunction("getInstalledBankApps") {
      val context = appContext.reactContext ?: error("Android context unavailable")
      installedBanks(context)
    }

    AsyncFunction("getCaptureAuthorization") {
      val context = appContext.reactContext
      val policy = try {
        if (context == null) CaptureAuthorization() else CapturePreferences(context).read()
      } catch (_: Exception) { CaptureAuthorization() }
      mapOf("enabled" to policy.enabled, "authorizedPackages" to policy.authorizedPackages.sorted())
    }

    AsyncFunction("updateCaptureAuthorization") { enabled: Boolean, packages: List<String> ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        synchronized(CapturePreferences.LOCK) {
          val policy = CaptureAuthorization.validated(enabled, packages, debuggable(context))
          if (enabled && (!captureSupported(context) || !notificationAccessGranted(context)
              || policy.authorizedPackages.isEmpty())) return@synchronized false
          val preferences = CapturePreferences(context)
          val newlySelected = policy.authorizedPackages - preferences.read().authorizedPackages
          val installed = if (enabled || newlySelected.isNotEmpty()) {
            installedBanks(context).map { it.getValue("packageName") }.toSet()
          } else emptySet()
          if (!installed.containsAll(newlySelected)
              || (enabled && !installed.containsAll(policy.authorizedPackages))) return@synchronized false
          preferences.update(enabled, policy.authorizedPackages.toList())
        }
      } catch (_: Exception) { false }
    }

    Function("hasPermission") {
      val context = appContext.reactContext ?: return@Function false
      notificationAccessGranted(context)
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
      // Compatibility stub: legacy plaintext content is no longer accessible.
      emptyList<Map<String, Any>>()
    }

    Function("removeCapturedNotification") { _: String ->
      false
    }
  }
}
