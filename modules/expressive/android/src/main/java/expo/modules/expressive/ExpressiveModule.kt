package expo.modules.expressive

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class UpdateException(message: String, cause: Throwable? = null) :
  CodedException("ERR_UPDATE", message, cause)

class PdfRenderException(message: String, cause: Throwable? = null) :
  CodedException("ERR_PDF_RENDER", message, cause)

/** Update APKs come only from GitHub release assets, over HTTPS (each redirect is checked too). */
private val UPDATE_HOSTS = setOf("github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com")

private fun checkUpdateUrl(url: URL) {
  if (url.protocol != "https" || url.host !in UPDATE_HOSTS) throw UpdateException("Updates only download from GitHub")
}

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

  /** Held here: SharedPreferences keeps listeners weakly. Fires when the widget queues a link. */
  private val quickSaveListener = SharedPreferences.OnSharedPreferenceChangeListener { prefs, key ->
    if (key == QuickSaveQueue.KEY && prefs.contains(QuickSaveQueue.KEY)) sendEvent("onQuickSave", emptyMap<String, Any>())
  }

  private fun quickSavePrefs(): SharedPreferences? =
    appContext.reactContext?.getSharedPreferences(QuickSaveQueue.PREFS, Context.MODE_PRIVATE)

  /**
   * Pulls selected text out of an intent exactly once: ACTION_SAVE_TEXT from
   * ProcessTextActivity, or a direct PROCESS_TEXT (older builds' manifest).
   */
  private fun consumeProcessText(intent: Intent?) {
    val text = when (intent?.action) {
      ACTION_SAVE_TEXT -> intent.getStringExtra(EXTRA_SAVE_TEXT).also { intent.removeExtra(EXTRA_SAVE_TEXT) }
      Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
        .also { intent.removeExtra(Intent.EXTRA_PROCESS_TEXT) }
      else -> return
    }
    intent.action = Intent.ACTION_MAIN
    if (text.isNullOrBlank()) return
    pendingProcessText = text
    sendEvent("onProcessText", mapOf("text" to text))
  }

  override fun definition() = ModuleDefinition {
    Name("Expressive")

    Events("onProcessText", "onUpdateProgress", "onQuickSave")

    OnCreate { quickSavePrefs()?.registerOnSharedPreferenceChangeListener(quickSaveListener) }
    OnDestroy { quickSavePrefs()?.unregisterOnSharedPreferenceChangeListener(quickSaveListener) }

    /** Returns (and clears) links the widget saved: [{ url, at }], oldest first. */
    Function("takeQuickSaves") {
      val context = appContext.reactContext ?: return@Function emptyList<Map<String, Any>>()
      QuickSaveQueue.take(context)
    }

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
     * Downloads a release APK into cache/updates (replacing older ones), sending
     * onUpdateProgress { received, total } about every 1%. Resolves with the file path.
     */
    AsyncFunction("downloadUpdate") { url: String, name: String ->
      val context = appContext.reactContext ?: throw UpdateException("No React context")
      val dir = File(context.cacheDir, "updates")
      dir.mkdirs()
      dir.listFiles()?.forEach { it.delete() }
      val out = File(dir, name.replace(Regex("[^A-Za-z0-9._-]"), "_"))
      val part = File(dir, out.name + ".part")
      try {
        checkUpdateUrl(URL(url))
        var conn = URL(url).openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = false
        // GitHub answers asset links with a redirect to its storage host.
        var hops = 0
        while (conn.responseCode in 300..399 && hops++ < 5) {
          val next = conn.getHeaderField("Location") ?: break
          conn.disconnect()
          val target = URL(conn.url, next)
          checkUpdateUrl(target)
          conn = target.openConnection() as HttpURLConnection
          conn.instanceFollowRedirects = false
        }
        if (conn.responseCode != 200) throw UpdateException("Download failed (${conn.responseCode})")
        val total = conn.contentLengthLong
        var received = 0L
        var lastSent = -1L
        conn.inputStream.use { input ->
          FileOutputStream(part).use { output ->
            val buf = ByteArray(64 * 1024)
            while (true) {
              val n = input.read(buf)
              if (n < 0) break
              output.write(buf, 0, n)
              received += n
              val step = if (total > 0) received * 100 / total else received / (256 * 1024)
              if (step != lastSent) {
                lastSent = step
                sendEvent("onUpdateProgress", mapOf("received" to received, "total" to total))
              }
            }
          }
        }
        conn.disconnect()
        if (total > 0 && received != total) throw UpdateException("Download was cut off")
        if (!part.renameTo(out)) throw UpdateException("Could not save the update")
        out.absolutePath
      } catch (e: UpdateException) {
        part.delete()
        throw e
      } catch (e: Exception) {
        part.delete()
        throw UpdateException(e.message ?: "Download failed", e)
      }
    }

    /** True when Android lets Stash install APKs ("Install unknown apps" is on for Stash). */
    Function("canInstallUpdates") {
      val context = appContext.reactContext ?: return@Function false
      context.packageManager.canRequestPackageInstalls()
    }

    /** Opens Settings → Install unknown apps for Stash. */
    Function("openInstallPermission") {
      val activity = appContext.currentActivity ?: return@Function null
      activity.startActivity(
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
      )
      null
    }

    /** Hands a downloaded APK (path from downloadUpdate) to the system installer. */
    Function("installUpdate") { path: String ->
      val activity = appContext.currentActivity ?: throw UpdateException("No activity")
      val file = File(path)
      if (!file.exists()) throw UpdateException("The update file is gone; download it again")
      // Only an update of Stash itself; Android then checks the signature matches the installed app.
      val info = activity.packageManager.getPackageArchiveInfo(file.absolutePath, 0)
      if (info?.packageName != activity.packageName) {
        file.delete()
        throw UpdateException("This file is not a Stash update")
      }
      val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", file)
      activity.startActivity(
        Intent(Intent.ACTION_VIEW)
          .setDataAndType(uri, "application/vnd.android.package-archive")
          .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      null
    }

    /**
     * Opens a saved file (file:// URI under files/) in the app the user picked as default for
     * its type, like tapping it in a file manager; Android asks which app when there is no
     * default. Resolves false when no installed app can open the type.
     */
    Function("openFile") { uri: String, mimeType: String? ->
      val activity = appContext.currentActivity ?: return@Function false
      val file = File(Uri.parse(uri).path ?: return@Function false)
      if (!file.exists()) return@Function false
      val content = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", file)
      val type = mimeType?.takeIf { it.isNotBlank() } ?: activity.contentResolver.getType(content) ?: "*/*"
      val view = Intent(Intent.ACTION_VIEW)
        .setDataAndType(content, type)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        activity.startActivity(view)
        true
      } catch (e: ActivityNotFoundException) {
        false
      }
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
