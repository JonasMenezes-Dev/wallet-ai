package expo.modules.statementpdf

import java.io.File
import java.net.URI

internal class PdfExtractionFailure(val reason: String) : Exception(reason)

/** Only the app's private cache is accepted; content/document-provider URIs must be copied first. */
internal object PrivatePdfInput {
  const val MAX_BYTES = 5L * 1024 * 1024

  fun resolve(uri: String, cacheDirectory: File): File {
    val parsed = try { URI(uri) } catch (_: Exception) { throw PdfExtractionFailure("invalid") }
    if (parsed.scheme != "file" || !parsed.authority.isNullOrEmpty() ||
      parsed.query != null || parsed.fragment != null || parsed.path.isNullOrEmpty()) {
      throw PdfExtractionFailure("invalid")
    }
    val cache = cacheDirectory.canonicalFile
    val file = try { File(parsed).canonicalFile } catch (_: Exception) { throw PdfExtractionFailure("invalid") }
    if (!file.path.startsWith(cache.path + File.separator) || !file.isFile || !file.canRead()) {
      throw PdfExtractionFailure("invalid")
    }
    if (file.length() <= 0L || file.length() > MAX_BYTES) throw PdfExtractionFailure("size")
    return file
  }
}
