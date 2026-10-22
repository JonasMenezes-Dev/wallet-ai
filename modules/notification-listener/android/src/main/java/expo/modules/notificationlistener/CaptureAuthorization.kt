package expo.modules.notificationlistener

internal data class CaptureAuthorization(
  val enabled: Boolean = false,
  val authorizedPackages: Set<String> = emptySet()
) {
  fun allows(packageName: String): Boolean = enabled && packageName in authorizedPackages

  fun forRuntime(debuggable: Boolean): CaptureAuthorization {
    if (debuggable || FIXTURE_PACKAGE !in authorizedPackages) return this
    val packages = authorizedPackages - FIXTURE_PACKAGE
    return copy(enabled = enabled && packages.isNotEmpty(), authorizedPackages = packages)
  }

  companion object {
    const val FIXTURE_PACKAGE = "com.walletai.notificationfixture"
    const val FIXTURE_DUPLICATE_EXTRA = "wallet.fixture.repeat_delivery"

    fun validated(enabled: Boolean, packages: List<String>, debuggable: Boolean = false): CaptureAuthorization {
      require(debuggable || FIXTURE_PACKAGE !in packages) { "Development source is not available" }
      require(packages.size <= 128) { "Too many authorized applications" }
      require(packages.all { it.length <= 255 && PACKAGE.matches(it) }) { "Invalid application identifier" }
      return CaptureAuthorization(enabled, packages.toSet())
    }

    private val PACKAGE = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+")
  }
}
