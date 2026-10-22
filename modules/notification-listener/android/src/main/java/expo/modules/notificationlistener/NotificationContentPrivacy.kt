package expo.modules.notificationlistener

import java.text.Normalizer
import java.util.Locale

/** Runs only after source authorization, before encrypted persistence. No logging or content retention. */
internal object NotificationContentPrivacy {
  private val marks = Regex("\\p{M}+")
  private val invisible = Regex("[\\p{Cf}]")
  private val credentials = Regex(
    "\\b(otp|pin|senhas?|passwords?|passcode|cvv|cvc|credencial|credenciais|credentials?|" +
      "tokens?|autenticacao|authentication|verification|verificacao|" +
      "autorizar|autorize|autorizacao|authorize|confirmar|confirme|" +
      "access_token|refresh_token|client_secret|authorization|bearer)\\b"
  )
  // Conservative: security wording varies. Only the ordinary barcode label is exempt.
  private val securityCode = Regex("\\b(codigo|code)\\b(?!\\s+de\\s+barras\\b)")
  private val login = Regex("\\b(login|usuario|username|user|email)\\s*[:=]")
  private val secretPhrase = Regex("\\b(chave (?:de acesso|secreta|privada)|private key|" +
    "recovery phrase|seed phrase|frase (?:de recuperacao|semente))\\b")
  private val cardNumber = Regex("(?<![0-9])(?:[0-9][ -]?){13,19}(?![0-9])")

  fun allows(title: String?, text: String?): Boolean {
    val content = invisible.replace(marks.replace(Normalizer.normalize(
      listOfNotNull(title, text).joinToString("\n"), Normalizer.Form.NFKD), ""), "")
      .lowercase(Locale.ROOT).replace(Regex("\\s+"), " ")
    return !credentials.containsMatchIn(content) && !securityCode.containsMatchIn(content) &&
      !login.containsMatchIn(content) && !secretPhrase.containsMatchIn(content) && !cardNumber.containsMatchIn(content)
  }
}
