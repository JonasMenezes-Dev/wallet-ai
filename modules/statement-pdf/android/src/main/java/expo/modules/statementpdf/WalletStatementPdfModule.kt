package expo.modules.statementpdf

import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.contentstream.operator.Operator
import com.tom_roush.pdfbox.cos.COSArray
import com.tom_roush.pdfbox.cos.COSBase
import com.tom_roush.pdfbox.cos.COSNumber
import com.tom_roush.pdfbox.cos.COSString
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.io.RandomAccessBufferedFileInputStream
import com.tom_roush.pdfbox.io.ScratchFile
import com.tom_roush.pdfbox.pdfparser.PDFParser
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException
import com.tom_roush.pdfbox.text.PDFTextStripper
import com.tom_roush.pdfbox.text.TextPosition
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.Writer
import java.io.IOException
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class WalletStatementPdfModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WalletStatementPdf")

    AsyncFunction("extractTextAsync") { uri: String ->
      try {
        val context = appContext.reactContext ?: throw PdfExtractionFailure("unavailable")
        val file = PrivatePdfInput.resolve(uri, context.cacheDir)
        PDFBoxResourceLoader.init(context.applicationContext)
        // No disk scratch files: decoded document streams stay in bounded private memory.
        ScratchFile(MemoryUsageSetting.setupMainMemoryOnly(32L * 1024 * 1024)).use { scratch ->
          RandomAccessBufferedFileInputStream(file).use { source ->
            val parser = PDFParser(source, scratch)
            parser.isLenient = false
            parser.parse()
            parser.pdDocument.use { document ->
              // Reject all encryption, including documents that open with an empty password.
              if (document.isEncrypted || !document.currentAccessPermission.canExtractContent()) {
                throw PdfExtractionFailure("protected")
              }
              if (document.numberOfPages !in 1..30) throw PdfExtractionFailure("pages")
              val stripper = StatementTextStripper()
              stripper.writeText(document, DiscardWriter)
              if (stripper.pages.none { page ->
                  @Suppress("UNCHECKED_CAST")
                  (page["items"] as List<Map<String, Any>>).any { (it["text"] as String).isNotBlank() }
                }) {
                throw PdfExtractionFailure("no_text")
              }
              mapOf("pages" to stripper.pages)
            }
          }
        }
      } catch (_: InvalidPasswordException) {
        throw CodedException("ERR_STATEMENT_PDF_PROTECTED", "PDF protegido não é aceito.", null)
      } catch (error: PdfExtractionFailure) {
        throw CodedException("ERR_STATEMENT_PDF_${error.reason.uppercase()}", "Não foi possível extrair texto deste PDF.", null)
      } catch (_: Throwable) {
        // Parser exceptions can include document text or paths; never retain their cause.
        throw CodedException("ERR_STATEMENT_PDF_INVALID", "Não foi possível extrair texto deste PDF.", null)
      }
    }.runOnQueue(Queues.DEFAULT)
  }
}

private object DiscardWriter : Writer() {
  override fun write(buffer: CharArray, offset: Int, length: Int) = Unit
  override fun flush() = Unit
  override fun close() = Unit
}

/** PDFBox sorts text positions before emitting words. Return word/chunk geometry, not one JSON object per glyph. */
private class StatementTextStripper : PDFTextStripper() {
  val pages = mutableListOf<Map<String, Any>>()
  private var items = mutableListOf<Map<String, Any>>()
  private var glyphCount = 0
  private var characterCount = 0

  init {
    sortByPosition = true
    suppressDuplicateOverlappingText = false
    setShouldSeparateByBeads(false)
  }

  override fun processTextPosition(text: TextPosition) {
    glyphCount += 1
    characterCount += text.unicode?.length ?: 0
    if (glyphCount > 250_000 || characterCount > 500_000) throw PdfExtractionFailure("text_limit")
    super.processTextPosition(text)
  }

  override fun operatorException(operator: Operator, operands: MutableList<COSBase>, error: IOException) {
    // PDFBox normally recovers from some invalid operators. Partial financial rows are unsafe.
    throw PdfExtractionFailure("invalid")
  }

  override fun showTextStrings(array: COSArray) {
    for (element in array) {
      if (element !is COSNumber && element !is COSString) throw PdfExtractionFailure("invalid")
    }
    super.showTextStrings(array)
  }

  override fun startPage(page: PDPage) {
    items = mutableListOf()
    val rotated = page.rotation % 180 != 0
    val width = if (rotated) page.cropBox.height else page.cropBox.width
    val height = if (rotated) page.cropBox.width else page.cropBox.height
    if (!width.isFinite() || !height.isFinite() || width <= 0 || height <= 0) {
      throw PdfExtractionFailure("geometry")
    }
    pages.add(mapOf("page" to currentPageNo, "width" to width.toDouble(), "height" to height.toDouble(), "items" to items))
  }

  override fun writeString(text: String, textPositions: MutableList<TextPosition>) {
    var chunk = mutableListOf<TextPosition>()
    fun flush() {
      if (chunk.isEmpty()) return
      // Use the source Unicode rather than PDFBox's compatibility-normalized word string.
      val original = chunk.joinToString("") { it.unicode ?: "" }
      if (original.isNotBlank()) {
        val x = chunk.minOf { it.xDirAdj }
        val y = chunk.minOf { it.yDirAdj - it.heightDir }
        val right = chunk.maxOf { it.xDirAdj + it.widthDirAdj }
        val bottom = chunk.maxOf { it.yDirAdj }
        items.add(mapOf("text" to original, "x" to x.toDouble(), "y" to y.toDouble(),
          "width" to max(0f, right - x).toDouble(), "height" to max(0f, bottom - y).toDouble()))
      }
      chunk = mutableListOf()
    }
    for (position in textPositions) {
      if (!position.xDirAdj.isFinite() || !position.yDirAdj.isFinite() ||
        !position.widthDirAdj.isFinite() || !position.heightDir.isFinite() ||
        position.widthDirAdj < 0 || position.heightDir < 0 || position.dir != 0f) {
        // Mixed/vertical text cannot be represented safely in the supported row parser.
        throw PdfExtractionFailure("geometry")
      }
      val previous = chunk.lastOrNull()
      val gap = if (previous != null) position.xDirAdj - previous.xDirAdj - previous.widthDirAdj else 0f
      val lineChanged = previous != null && abs(previous.yDirAdj - position.yDirAdj) > max(1f, min(previous.heightDir, position.heightDir) * 0.4f)
      if (lineChanged || gap > max(1f, position.widthOfSpace * 0.5f)) flush()
      chunk.add(position)
      if (position.unicode?.any { it.isWhitespace() } == true) flush()
    }
    flush()
  }
}
