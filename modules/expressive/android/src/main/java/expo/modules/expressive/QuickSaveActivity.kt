package expo.modules.expressive

import android.app.Activity
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject

/** Same pattern as `extractUrl` in src/features/capture/normalize.ts. */
private val URL_RE = Regex("""\bhttps?://[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}]""", RegexOption.IGNORE_CASE)
private const val MAX_URL = 4096
private const val MAX_QUEUED = 100

/**
 * Links saved from the widget while Stash's JS isn't running. Kept in SharedPreferences until
 * the app takes them (ExpressiveModule.takeQuickSaves) and saves them through the normal path
 * (duplicate check, preview fetch). Nothing runs in the background.
 */
object QuickSaveQueue {
  const val PREFS = "stash_quick_save"
  const val KEY = "links"

  fun add(context: Context, url: String) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val list = read(prefs.getString(KEY, null))
    if (list.length() >= MAX_QUEUED) return
    list.put(JSONObject().put("url", url).put("at", System.currentTimeMillis()))
    prefs.edit().putString(KEY, list.toString()).apply()
  }

  /** Returns every queued link (oldest first) and empties the queue. */
  fun take(context: Context): List<Map<String, Any>> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val raw = prefs.getString(KEY, null) ?: return emptyList()
    prefs.edit().remove(KEY).apply()
    val list = read(raw)
    return (0 until list.length()).mapNotNull { i ->
      val o = list.optJSONObject(i) ?: return@mapNotNull null
      val url = o.optString("url").takeIf { it.isNotBlank() } ?: return@mapNotNull null
      mapOf("url" to url, "at" to o.optLong("at"))
    }
  }

  private fun read(raw: String?): JSONArray =
    try {
      if (raw.isNullOrBlank()) JSONArray() else JSONArray(raw)
    } catch (e: Exception) {
      JSONArray()
    }
}

/**
 * Widget "Paste link": saves the copied link without opening Stash. Android only lets the
 * focused window read the clipboard, so this invisible activity waits for focus, reads it,
 * queues the link, shows a toast and closes.
 */
class QuickSaveActivity : Activity() {
  private var handled = false
  private val handler = Handler(Looper.getMainLooper())

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Some launchers never hand focus over; don't leave an invisible window behind.
    handler.postDelayed({ done(R.string.stash_quick_save_failed) }, 2000)
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (!hasFocus || handled) return
    val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
    val clip = clipboard.primaryClip
    val text = if (clip != null && clip.itemCount > 0) clip.getItemAt(0).coerceToText(this)?.toString() else null
    val url = text?.let { URL_RE.find(it)?.value }?.takeIf { it.length <= MAX_URL }
    if (url == null) {
      done(R.string.stash_quick_save_no_link)
      return
    }
    QuickSaveQueue.add(this, url)
    done(R.string.stash_quick_save_done)
  }

  private fun done(message: Int) {
    if (handled) return
    handled = true
    handler.removeCallbacksAndMessages(null)
    Toast.makeText(applicationContext, message, Toast.LENGTH_SHORT).show()
    finish()
    overridePendingTransition(0, 0)
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    super.onDestroy()
  }
}
