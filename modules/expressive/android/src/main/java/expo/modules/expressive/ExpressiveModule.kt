package expo.modules.expressive

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.expressive.stash.StashActionEvent
import expo.modules.expressive.stash.StashDetailContent
import expo.modules.expressive.stash.StashDetailProps
import expo.modules.expressive.stash.StashQuickSaveContent
import expo.modules.expressive.stash.StashQuickSaveProps
import expo.modules.expressive.stash.StashHomeContent
import expo.modules.expressive.stash.StashHomeProps
import expo.modules.expressive.stash.StashNavToolbarContent
import expo.modules.expressive.stash.StashNavToolbarProps
import expo.modules.ui.ExpoUIView
import java.io.File
import java.io.FileOutputStream

class PdfRenderException(message: String, cause: Throwable? = null) :
  CodedException("ERR_PDF_RENDER", message, cause)

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

    ExpoUIView<ExpressiveThemeProps>("ExpressiveThemeView") {
      Content { props -> ExpressiveThemeContent(props) }
    }

    ExpoUIView<ConnectedButtonGroupProps>("ConnectedButtonGroupView") {
      val onSelectionChange by Event<SelectionChangeEvent>()
      Content { props ->
        ConnectedButtonGroupContent(props) { keys -> onSelectionChange(SelectionChangeEvent(keys)) }
      }
    }

    ExpoUIView<FabMenuProps>("FabMenuView") {
      val onItemPress by Event<FabMenuItemEvent>()
      val onExpandedChange by Event<FabMenuExpandedEvent>()
      Content { props ->
        FabMenuContent(
          props,
          onItemPress = { onItemPress(FabMenuItemEvent(it)) },
          onExpandedChange = { onExpandedChange(FabMenuExpandedEvent(it)) }
        )
      }
    }

    ExpoUIView<MorphingShapeProps>("MorphingShapeView") {
      Content { props -> MorphingShapeContent(props) }
    }

    // Whole native screens (Stash v2). Data comes in as display records; intents go out as onAction.
    ExpoUIView<StashHomeProps>("StashHomeView") {
      val onAction by Event<StashActionEvent>()
      Content { props -> StashHomeContent(props) { a, k -> onAction(StashActionEvent(a, k)) } }
    }

    ExpoUIView<StashDetailProps>("StashDetailView") {
      val onAction by Event<StashActionEvent>()
      Content { props -> StashDetailContent(props) { a, k, v -> onAction(StashActionEvent(a, k, v)) } }
    }

    ExpoUIView<StashQuickSaveProps>("StashQuickSaveView") {
      val onAction by Event<StashActionEvent>()
      Content { props -> StashQuickSaveContent(props) { a, k, v -> onAction(StashActionEvent(a, k, v)) } }
    }

    ExpoUIView<StashNavToolbarProps>("StashNavToolbarView") {
      val onAction by Event<StashActionEvent>()
      Content { props -> StashNavToolbarContent(props) { a, k -> onAction(StashActionEvent(a, k)) } }
    }
  }
}
