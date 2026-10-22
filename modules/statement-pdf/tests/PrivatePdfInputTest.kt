package expo.modules.statementpdf

import java.io.File
import java.nio.file.Files

fun main() {
  val root = Files.createTempDirectory("statement-pdf-policy-test").toFile()
  try {
    val cache = File(root, "cache").apply { mkdir() }
    val valid = File(cache, "synthetic.pdf").apply { writeText("%PDF-1.7\n") }
    check(PrivatePdfInput.resolve(valid.toURI().toString(), cache) == valid.canonicalFile)
    fun rejects(uri: String) {
      check(runCatching { PrivatePdfInput.resolve(uri, cache) }.isFailure)
    }
    rejects(File(root, "outside.pdf").apply { writeText("synthetic") }.toURI().toString())
    rejects(File(root, "cache-other/synthetic.pdf").apply { parentFile.mkdirs(); writeText("synthetic") }.toURI().toString())
    rejects(File(cache, "empty.pdf").apply { createNewFile() }.toURI().toString())
    rejects(File(cache, "missing.pdf").toURI().toString())
    rejects(cache.toURI().toString())
    rejects("content://documents/synthetic.pdf")
    rejects("https://example.invalid/synthetic.pdf")
    rejects("file://remote${valid.absolutePath}")
    rejects(valid.toURI().toString() + "?query=1")
    rejects(valid.toURI().toString() + "#fragment")
    rejects(valid.absolutePath)
    val oversized = File(cache, "large.pdf")
    java.io.RandomAccessFile(oversized, "rw").use { it.setLength(5L * 1024 * 1024 + 1) }
    rejects(oversized.toURI().toString())
    val link = File(cache, "linked.pdf").toPath()
    // Windows may disallow symlinks without developer mode; canonical traversal is always tested.
    if (runCatching { Files.createSymbolicLink(link, File(root, "outside.pdf").toPath()) }.isSuccess) {
      rejects(link.toUri().toString())
    }
    rejects(File(cache, "../outside.pdf").toURI().toString())
    println("PrivatePdfInput: synthetic policy checks passed")
  } finally {
    root.deleteRecursively()
  }
}
