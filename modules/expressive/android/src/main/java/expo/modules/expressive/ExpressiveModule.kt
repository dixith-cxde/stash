package expo.modules.expressive

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class PdfRenderException(message: String, cause: Throwable? = null) :
  CodedException("ERR_PDF_RENDER", message, cause)

private val DYNAMIC_ROLES = listOf(
  "primary", "onPrimary", "primaryContainer", "onPrimaryContainer",
  "secondary", "onSecondary", "secondaryContainer", "onSecondaryContainer",
  "tertiary", "onTertiary", "tertiaryContainer", "onTertiaryContainer",
  "error", "onError", "errorContainer", "onErrorContainer",
  "background", "onBackground", "surface", "onSurface", "surfaceVariant", "onSurfaceVariant",
  "surfaceBright", "surfaceDim", "surfaceContainerLowest", "surfaceContainerLow",
  "surfaceContainer", "surfaceContainerHigh", "surfaceContainerHighest",
  "outline", "outlineVariant",
  "primaryFixed", "primaryFixedDim", "onPrimaryFixed", "onPrimaryFixedVariant",
  "secondaryFixed", "secondaryFixedDim", "onSecondaryFixed", "onSecondaryFixedVariant",
  "tertiaryFixed", "tertiaryFixedDim", "onTertiaryFixed", "onTertiaryFixedVariant",
)

class ExpressiveModule : Module() {
  private var pendingProcessText: String? = null

  /** Pulls ACTION_PROCESS_TEXT payloads out of an intent exactly once. */
  private fun consumeProcessText(intent: Intent?) {
    if (intent?.action != Intent.ACTION_PROCESS_TEXT) return
    val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
    intent.removeExtra(Intent.EXTRA_PROCESS_TEXT)
    intent.action = Intent.ACTION_MAIN
    if (text.isNullOrBlank()) return
    pendingProcessText = text
    sendEvent("onProcessText", mapOf("text" to text))
  }

  override fun definition() = ModuleDefinition {
    Name("Expressive")

    Events("onProcessText")

    OnActivityEntersForeground { consumeProcessText(appContext.currentActivity?.intent) }
    OnNewIntent { intent -> consumeProcessText(intent) }

    /** Returns (and clears) text selected in another app via the "Save to Stash" menu. */
    Function("takePendingProcessText") {
      consumeProcessText(appContext.currentActivity?.intent)
      val text = pendingProcessText
      pendingProcessText = null
      text
    }

    /**
     * Wallpaper-based dynamic color (Android 12+). Returns `seed` (the system accent) and, on
     * Android 14+, every color role the platform exposes as `system_<role>_<light|dark>`,
     * keyed by camelCase role name. JS fills any missing role from the seed. Null below API 31.
     */
    Function("getDynamicColors") { dark: Boolean ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function null
      val context = appContext.reactContext ?: return@Function null
      val res = context.resources
      fun color(name: String): String? {
        val id = res.getIdentifier(name, "color", "android")
        if (id == 0) return null
        return String.format("#%06X", 0xFFFFFF and context.getColor(id))
      }
      val out = mutableMapOf<String, String>()
      color("system_accent1_500")?.let { out["seed"] = it }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val suffix = if (dark) "_dark" else "_light"
        for (role in DYNAMIC_ROLES) {
          val snake = role.replace(Regex("([A-Z])"), "_$1").lowercase()
          (color("system_$snake$suffix") ?: color("system_$snake"))?.let { out[role] = it }
        }
      }
      out
    }

    /**
     * Renders one PDF page to a JPEG using the platform PdfRenderer.
     * `source` is a file:// or content:// URI, `output` a file:// URI.
     */
    AsyncFunction("renderPdfPage") { source: String, output: String, width: Int, page: Int ->
      val context = appContext.reactContext ?: throw PdfRenderException("No React context")
      val uri = Uri.parse(source)
      val descriptor = try {
        if (uri.scheme == "content") {
          context.contentResolver.openFileDescriptor(uri, "r")
        } else {
          ParcelFileDescriptor.open(File(uri.path ?: source), ParcelFileDescriptor.MODE_READ_ONLY)
        }
      } catch (e: Exception) {
        throw PdfRenderException("Cannot open $source", e)
      } ?: throw PdfRenderException("Cannot open $source")

      descriptor.use { fd ->
        PdfRenderer(fd).use { renderer ->
          if (page !in 0 until renderer.pageCount) {
            throw PdfRenderException("Page $page out of range (0..${renderer.pageCount - 1})")
          }
          renderer.openPage(page).use { pdfPage ->
            val height = (width.toFloat() * pdfPage.height / pdfPage.width).toInt().coerceAtLeast(1)
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(android.graphics.Color.WHITE)
            pdfPage.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            val outFile = File(Uri.parse(output).path ?: output)
            outFile.parentFile?.mkdirs()
            FileOutputStream(outFile).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 85, it) }
            bitmap.recycle()
            mapOf(
              "uri" to Uri.fromFile(outFile).toString(),
              "width" to width,
              "height" to height,
              "pageCount" to renderer.pageCount
            )
          }
        }
      }
    }
  }
}
