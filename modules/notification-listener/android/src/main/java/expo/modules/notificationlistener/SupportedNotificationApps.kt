package expo.modules.notificationlistener

/** Discovery catalog, never an authorization list. Primary sources: docs/supported-notification-apps.md. */
internal object SupportedNotificationApps {
  val catalog: Map<String, String> = linkedMapOf(
    "br.com.bb.android" to "Banco do Brasil",
    "com.bradesco" to "Bradesco",
    "br.com.intermedium" to "Inter",
    "com.itau" to "Itaú",
    "com.nu.production" to "Nubank",
    "com.santander.app" to "Santander",
    "com.google.android.apps.walletnfcrel" to "Google Wallet",
    "com.samsung.android.spay" to "Samsung Wallet",
    "com.picpay" to "PicPay",
    "com.mercadopago.wallet" to "Mercado Pago",
    "br.com.uol.ps.myaccount" to "PagBank",
    "com.recarga.recarga" to "RecargaPay"
  )
}
