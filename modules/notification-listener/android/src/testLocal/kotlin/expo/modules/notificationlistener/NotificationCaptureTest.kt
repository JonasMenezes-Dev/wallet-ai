package expo.modules.notificationlistener

import java.util.concurrent.Executor
import java.util.concurrent.RejectedExecutionException

/** Standalone JVM tests: no Android runtime, test library or device required. */
fun main() {
  var passed = 0
  fun test(name: String, body: () -> Unit) {
    body()
    passed++
    println("PASS: $name")
  }
  val direct = Executor { it.run() }
  fun dispatcher(policy: () -> CaptureAuthorization, executor: Executor = direct) =
    NotificationCaptureDispatcher(Any(), policy, executor, { 0L })
  val bank = "com.example.bank"
  val allowed = CaptureAuthorization.validated(true, listOf(bank))

  test("authorized content is read and persisted, in that order") {
    val effects = mutableListOf<String>()
    val dispatcher = dispatcher({ allowed })
    dispatcher.capture(bank, { effects.add("read"); "payload" }, { effects.add("persist:$it") })
    check(effects == listOf("read", "persist:payload"))
  }
  test("disabled, empty and unauthorized policies never access content") {
    for (policy in listOf(CaptureAuthorization(), CaptureAuthorization(false, setOf(bank)),
      CaptureAuthorization(true), allowed)) {
      val source = if (policy === allowed) "com.example.other" else bank
      var effects = 0
      dispatcher({ policy }).capture(source,
        { effects++; "payload" }, { effects++ })
      check(effects == 0)
    }
  }
  test("unavailable or corrupt preferences deny capture") {
    for (failure in listOf(java.io.IOException(), java.security.GeneralSecurityException(), IllegalArgumentException())) {
      var effects = 0
      dispatcher({ throw failure }).capture(bank,
        { effects++; "payload" }, { effects++ })
      check(effects == 0)
    }
  }
  test("revocation while an event waits prevents reading its content") {
    val pending = mutableListOf<Runnable>()
    var policy = allowed
    var effects = 0
    val dispatcher = dispatcher({ policy }, Executor { pending.add(it) })
    dispatcher.capture(bank, { effects++; "payload" }, { effects++ })
    policy = CaptureAuthorization()
    check(pending.size == 1)
    pending.single().run()
    check(effects == 0)
  }
  test("authorization is checked again before persistence") {
    var policy = allowed
    var reads = 0
    var writes = 0
    dispatcher({ policy }).capture(bank,
      { reads++; policy = CaptureAuthorization(); "payload" }, { writes++ })
    check(reads == 1)
    check(writes == 0)
  }
  test("storage, cryptography and extraction failures do not block the next event") {
    for (failure in listOf(java.io.IOException(), java.security.GeneralSecurityException(), IllegalStateException())) {
      val dispatcher = dispatcher({ allowed })
      dispatcher.capture(bank, { "payload" }, { throw failure })
      var invalidWrites = 0
      dispatcher.capture(bank, { throw failure }, { _: String -> invalidWrites++ })
      check(invalidWrites == 0)
      var stored = ""
      dispatcher.capture(bank, { "next" }, { stored = it })
      check(stored == "next")
    }
  }
  test("preferences becoming unavailable after extraction prevent persistence") {
    var reads = 0
    var writes = 0
    var available = true
    dispatcher({ if (!available) throw java.io.IOException() else allowed }).capture(bank,
      { reads++; available = false; "payload" }, { writes++ })
    check(reads == 1 && writes == 0)
  }
  test("executor rejection does not read content or escape") {
    var effects = 0
    dispatcher({ allowed }, Executor { throw RejectedExecutionException() })
      .capture(bank, { effects++; "payload" }, { effects++ })
    check(effects == 0)
  }
  test("valid package identifiers are exact and invalid identifiers are rejected") {
    val policy = CaptureAuthorization.validated(true, listOf(bank, bank, "br.com.bank_app2"))
    check(policy.authorizedPackages.size == 2)
    check(policy.allows(bank))
    check(!policy.allows("com.example.bank.fake"))
    for (invalid in listOf("", "*", "com.*", "com", ".com.bank", "com..bank", "com.bank.",
      " com.bank", "com.bank ", "com.2bank", "com.bank/app", "com." + "a".repeat(252))) {
      var rejected = false
      try { CaptureAuthorization.validated(true, listOf(invalid)) }
      catch (_: IllegalArgumentException) { rejected = true }
      check(rejected) { "Accepted invalid package identifier" }
    }
    var rejected = false
    try { CaptureAuthorization.validated(true, List(129) { "com.example.bank$it" }) }
    catch (_: IllegalArgumentException) { rejected = true }
    check(rejected)
  }
  test("enabling capture never imports events queued while it was disabled") {
    val pending = mutableListOf<Runnable>()
    var policy = CaptureAuthorization()
    var revision = 0L
    var effects = 0
    val dispatcher = NotificationCaptureDispatcher(Any(), { policy }, Executor { pending.add(it) }, { revision })
    dispatcher.capture(bank, { effects++; "payload" }, { effects++ })
    policy = allowed
    revision++
    pending.single().run()
    check(effects == 0) { "Captured an event predating consent" }
  }
  test("persisted debug fixture authorization is denied in production without blocking real banks") {
    val persisted = CaptureAuthorization(true, setOf(bank, CaptureAuthorization.FIXTURE_PACKAGE))
    check(persisted.forRuntime(true).allows(CaptureAuthorization.FIXTURE_PACKAGE))
    val production = persisted.forRuntime(false)
    check(!production.allows(CaptureAuthorization.FIXTURE_PACKAGE))
    check(production.allows(bank))
    check(!CaptureAuthorization(true, setOf(CaptureAuthorization.FIXTURE_PACKAGE)).forRuntime(false).enabled)
    var accesses = 0
    dispatcher({ production }).capture(CaptureAuthorization.FIXTURE_PACKAGE,
      { accesses++; "fictional" }, { accesses++ })
    check(accesses == 0)
  }
  test("fixture selection requires a debuggable runtime and never overrides default-off capture") {
    var rejected = false
    try { CaptureAuthorization.validated(true, listOf(CaptureAuthorization.FIXTURE_PACKAGE)) }
    catch (_: IllegalArgumentException) { rejected = true }
    check(rejected)
    val explicit = CaptureAuthorization.validated(false, listOf(CaptureAuthorization.FIXTURE_PACKAGE), true)
    check(!explicit.allows(CaptureAuthorization.FIXTURE_PACKAGE))
    check(!CaptureAuthorization().forRuntime(true).allows(CaptureAuthorization.FIXTURE_PACKAGE))
    check(CaptureAuthorization.validated(true, listOf(CaptureAuthorization.FIXTURE_PACKAGE), true)
      .allows(CaptureAuthorization.FIXTURE_PACKAGE))
  }
  test("privacy rejects OTPs and credentials before any persistence, including mixed transactions") {
    val sensitive = listOf(
      "Seu código de segurança é 123456", "OTP: 123456", "Senha temporária: ficticia123",
      "Seu PIN é 1234", "CVV: 123", "CVC: 123", "Password: fictitious",
      "Código de verificação: 123456", "Código de confirmação: 123456",
      "123456 é seu código", "Your code is 123456", "Codigo: AB123C",
      "Código de acesso para entrar", "Token de autenticação: 123456",
      "Use 123456 para autorizar sua compra", "Código abaixo para aprovar: ABCDEF",
      "Credencial: ficticia", "Chave de acesso: ficticia", "Recovery phrase: fictional words",
      "login: pessoa-ficticia", "username=fictional", "Bearer fictional-credential",
      "access_token: ficticio", "client_secret: ficticio", "senha\n ficticia",
      "SÉNHA: exemplo", "s\u200Benha: exemplo", "Compra de R$ 12,34. Código de segurança: 123456",
      "Cartão 4111 1111 1111 1111"
    )
    for (text in sensitive) {
      check(!NotificationContentPrivacy.allows(null, text)) { "Sensitive content accepted" }
      check(!NotificationContentPrivacy.allows(text, "Compra de R$ 12,34")) { "Sensitive title accepted" }
      var writes = 0
      dispatcher({ allowed }).capture(bank, { text }, {
        if (NotificationContentPrivacy.allows(null, it)) writes++
      })
      check(writes == 0)
    }
  }
  test("ordinary fictional financial messages remain available for review") {
    for (text in listOf(
      "Pix enviado de R$ 12,34 para PESSOA FICTÍCIA", "Pix recebido de R$ 56,78",
      "Compra no débito de R$ 23,45 em LOJA FICTÍCIA", "Compra no crédito de R$ 67,89",
      "Compra por aproximação de R$ 45,67. Origem simulada: wallet",
      "Estorno de compra de R$ 23,45", "Compra aprovada no cartão final 1234",
      "Boleto pago por código de barras. R$ 12,34", "Compra aprovada", "Promoção: R$ 10,00 de desconto"
    )) check(NotificationContentPrivacy.allows("TESTE", text))
    check(NotificationContentPrivacy.allows(null, null))
  }
  test("catalog expansion never imports authorization or opens arbitrary application discovery") {
    check(SupportedNotificationApps.catalog.size == 12)
    check("com.google.android.apps.walletnfcrel" in SupportedNotificationApps.catalog)
    check("com.samsung.android.spay" in SupportedNotificationApps.catalog)
    check(CaptureAuthorization.FIXTURE_PACKAGE !in SupportedNotificationApps.catalog)
    for (source in SupportedNotificationApps.catalog.keys) check(!CaptureAuthorization().allows(source))
    val existing = CaptureAuthorization.validated(true, listOf("com.nu.production"))
    check(!existing.allows("com.google.android.apps.walletnfcrel"))
    check(!existing.allows("com.example.unrelated"))
  }
  println("$passed capture tests passed")
}
