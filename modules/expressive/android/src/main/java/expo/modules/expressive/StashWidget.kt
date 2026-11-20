package expo.modules.expressive

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * "Save to Stash" home-screen widget. Static buttons only (nothing to refresh, no background
 * work): each opens MainActivity with a stash:// deep link that Expo Router sends to /capture.
 * Colors follow the wallpaper on Android 12+ (res/values*-v31/stash_widget_colors.xml).
 */
class StashWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val views = RemoteViews(context.packageName, R.layout.stash_widget).apply {
      setOnClickPendingIntent(R.id.stash_widget_paste, capture(context, 1, "paste=1"))
      setOnClickPendingIntent(R.id.stash_widget_note, capture(context, 2, "mode=note"))
      setOnClickPendingIntent(R.id.stash_widget_file, capture(context, 3, "mode=file"))
    }
    manager.updateAppWidget(ids, views)
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
