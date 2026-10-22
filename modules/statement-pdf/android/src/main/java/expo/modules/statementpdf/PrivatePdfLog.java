package expo.modules.statementpdf;

/** Call target for the PDFBox-only AAR transform. Never forwards document data to Android logging. */
public final class PrivatePdfLog {
  private PrivatePdfLog() {}
  public static int v(String tag, String message) { return 0; }
  public static int v(String tag, String message, Throwable cause) { return 0; }
  public static int d(String tag, String message) { return 0; }
  public static int d(String tag, String message, Throwable cause) { return 0; }
  public static int i(String tag, String message) { return 0; }
  public static int i(String tag, String message, Throwable cause) { return 0; }
  public static int w(String tag, String message) { return 0; }
  public static int w(String tag, String message, Throwable cause) { return 0; }
  public static int w(String tag, Throwable cause) { return 0; }
  public static int e(String tag, String message) { return 0; }
  public static int e(String tag, String message, Throwable cause) { return 0; }
  public static int wtf(String tag, String message) { return 0; }
  public static int wtf(String tag, String message, Throwable cause) { return 0; }
  public static int wtf(String tag, Throwable cause) { return 0; }
  public static int println(int priority, String tag, String message) { return 0; }
  public static boolean isLoggable(String tag, int priority) { return false; }
  public static String getStackTraceString(Throwable cause) { return ""; }
}
