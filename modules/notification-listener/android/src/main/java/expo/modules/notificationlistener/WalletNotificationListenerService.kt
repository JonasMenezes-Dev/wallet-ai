package expo.modules.notificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

class WalletNotificationListenerService : NotificationListenerService() {
  companion object {
    private const val PREFS = "wallet_notification_listener"
    private const val KEY_EVENTS = "captured_events"
    private val BANK_PACKAGES = setOf(
      "com.nu.production",
      "br.com.intermedium",
      "com.itau",
      "com.santander.app",
      "com.bradesco",
      "br.com.bb.android",
      "br.gov.caixa.tem",
      "com.picpay",
      "com.mercadopago.wallet",
      "com.c6bank.app",
      "com.original.bank",
      "com.pagsmile"
    )
    private val FINANCIAL_TERMS = Regex(
      "\\b(pix|compra|pagamento|cart[aã]o|transfer[eê]ncia|recebeu|recebido|debito|d[eé]bito|cr[eé]dito|compra aprovada|compra realizada)\\b",
      RegexOption.IGNORE_CASE
    )
    private val MONEY = Regex("R\\$\\s?\\d")
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (!BANK_PACKAGES.contains(sbn.packageName)) return
    val extras = sbn.notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
    val text = (
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
        ?: ""
    ).trim()
    if (title.isBlank() || text.isBlank()) return
    if (!FINANCIAL_TERMS.containsMatchIn("$title $text") && !MONEY.containsMatchIn(text)) return

    val eventKey = "${sbn.packageName}:${sbn.postTime}:${title.hashCode()}:${text.hashCode()}"
    val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
    val existing = try { JSONArray(prefs.getString(KEY_EVENTS, "[]")) } catch (_: Exception) { JSONArray() }
    for (i in 0 until existing.length()) {
      if (existing.optJSONObject(i)?.optString("key") == eventKey) return
    }

    val event = JSONObject()
      .put("key", eventKey)
      .put("title", title.take(160))
      .put("text", text.take(500))
      .put("packageName", sbn.packageName)
      .put("postedAt", sbn.postTime)
    val updated = JSONArray()
    updated.put(event)
    for (i in 0 until minOf(existing.length(), 49)) {
      existing.optJSONObject(i)?.let { updated.put(it) }
    }
    prefs.edit().putString(KEY_EVENTS, updated.toString()).apply()
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) {
    // Mantemos a notificação capturada até o usuário importar ou dispensá-la no Wallet.
  }
}
