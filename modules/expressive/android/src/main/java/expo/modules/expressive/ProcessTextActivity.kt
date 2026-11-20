package expo.modules.expressive

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/** Action MainActivity receives with the selected text (see ExpressiveModule.consumeProcessText). */
const val ACTION_SAVE_TEXT = "app.stash.action.SAVE_TEXT"
const val EXTRA_SAVE_TEXT = "app.stash.extra.TEXT"

/**
 * Receives "Save to Stash" from another app's text-selection menu and forwards the text to
 * MainActivity in Stash's own task. Has no UI and finishes at once.
 */
class ProcessTextActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val text = intent?.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    if (!text.isNullOrBlank() && launch?.component != null) {
      startActivity(
        Intent(ACTION_SAVE_TEXT)
          .setComponent(launch.component)
          .putExtra(EXTRA_SAVE_TEXT, text)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }
    // The caller asked for a result (it may replace the selection with one); leave it as is.
    setResult(RESULT_CANCELED)
    finish()
  }
}
