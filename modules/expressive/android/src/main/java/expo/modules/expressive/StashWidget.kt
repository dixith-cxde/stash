package expo.modules.expressive

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * "Save to Stash" home-screen widgets. Static buttons only (nothing to refresh, no background
 * work). Paste link saves the copied link at once (QuickSaveActivity: toast, nothing opens);
 * Note and File open MainActivity with a stash:// deep link that Expo Router sends to /capture.
 * Colors follow the wallpaper on Android 12+ (res/values*-v31/stash_widget_colors.xml).
 * Both layouts use the same button ids: stash_widget_paste / _note / _file.
 */
abstract class CaptureWidget(private val layout: Int) : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val views = RemoteViews(context.packageName, layout).apply {
      setOnClickPendingIntent(R.id.stash_widget_paste, quickSave(context))
      setOnClickPendingIntent(R.id.stash_widget_note, capture(context, 2, "mode=note"))
      setOnClickPendingIntent(R.id.stash_widget_file, capture(context, 3, "mode=file"))
    }
    manager.updateAppWidget(ids, views)
  }

  private fun quickSave(context: Context): PendingIntent {
    val intent = Intent()
      .setComponent(ComponentName(context, QuickSaveActivity::class.java))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
    return PendingIntent.getActivity(
      context,
      1,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun capture(context: Context, requestCode: Int, query: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("stash://capture?$query"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}

/** 4x1 pill bar: Paste link pill, note circle, file square. */
class StashWidget : CaptureWidget(R.layout.stash_widget)

/** 2x2 "Stash quick add": a big Paste link tile over a note pill and a file square. */
class StashWidgetLarge : CaptureWidget(R.layout.stash_widget_large)
