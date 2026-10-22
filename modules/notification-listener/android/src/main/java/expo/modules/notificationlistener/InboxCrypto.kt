package expo.modules.notificationlistener

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.nio.ByteBuffer
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** No plaintext fallback. Keys never leave Android Keystore. Call off the main thread. */
internal class InboxCrypto(
  private val aesAlias: String = AES_ALIAS,
  private val hmacAlias: String = HMAC_ALIAS
) {
  private fun key(alias: String, hmac: Boolean, create: Boolean): SecretKey {
    synchronized(KEY_LOCK) {
      val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
      if (store.containsAlias(alias)) return store.getKey(alias, null) as SecretKey
      if (!create) throw java.security.KeyStoreException("Inbox key unavailable")
      val algorithm = if (hmac) KeyProperties.KEY_ALGORITHM_HMAC_SHA256 else KeyProperties.KEY_ALGORITHM_AES
      val purposes = if (hmac) KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        else KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
      val spec = KeyGenParameterSpec.Builder(alias, purposes).setKeySize(256)
      if (hmac) spec.setDigests(KeyProperties.DIGEST_SHA256)
      else spec.setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
      return KeyGenerator.getInstance(algorithm, "AndroidKeyStore").run {
        init(spec.build())
        generateKey()
      }
    }
  }

  fun ensureAvailable(allowCreate: Boolean) {
    key(aesAlias, false, allowCreate)
    key(hmacAlias, true, allowCreate)
  }

  fun fingerprint(value: String): String = Mac.getInstance("HmacSHA256").run {
    init(key(hmacAlias, true, false))
    doFinal(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
  }

  fun encrypt(value: String, aad: String): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key(aesAlias, false, false))
    cipher.updateAAD(aad.toByteArray(Charsets.UTF_8))
    val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
    return ByteBuffer.allocate(1 + 12 + ciphertext.size)
      .put(1.toByte()).put(cipher.iv.also { check(it.size == 12) }).put(ciphertext).array()
  }

  fun decrypt(value: ByteArray, aad: String): String {
    require(value.size >= 29 && value[0] == 1.toByte()) { "Invalid inbox ciphertext" }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, key(aesAlias, false, false), GCMParameterSpec(128, value.copyOfRange(1, 13)))
    cipher.updateAAD(aad.toByteArray(Charsets.UTF_8))
    return String(cipher.doFinal(value.copyOfRange(13, value.size)), Charsets.UTF_8)
  }

  companion object {
    private val KEY_LOCK = Any()
    private const val AES_ALIAS = "wallet_notification_inbox_aes_v1"
    private const val HMAC_ALIAS = "wallet_notification_inbox_hmac_v1"
  }
}
