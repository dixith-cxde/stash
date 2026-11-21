package expo.modules.expressive

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import java.io.File

/**
 * Installs a downloaded update APK in-app through a PackageInstaller session: Stash streams
 * the file into the session and commits it; Android then shows only its own confirm sheet
 * (and none at all on Android 12+ once Stash installed the current version itself).
 * Results come back to [UpdateInstallReceiver] and are forwarded to [listener].
 */
object UpdateInstaller {
  /** status: "confirm" (with the system's confirm intent), "success", "cancelled" or "failed". */
  fun interface Listener {
    fun onStatus(status: String, message: String?, confirm: Intent?)
  }

  @Volatile var listener: Listener? = null

  /** A confirm intent that arrived while no activity was in front; launched on resume. */
  @Volatile var pendingConfirm: Intent? = null

  /** Creates, fills and commits an install session. Throws on any failure (caller falls back). */
  fun install(context: Context, apk: File) {
    val installer = context.packageManager.packageInstaller
    // Leftovers from an earlier attempt would hold a copy of the APK in system storage.
    for (s in installer.mySessions) runCatching { installer.abandonSession(s.sessionId) }

    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
      setAppPackageName(context.packageName)
      setSize(apk.length())
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        setPackageSource(PackageInstaller.PACKAGE_SOURCE_DOWNLOADED_FILE)
      }
    }
    val id = installer.createSession(params)
    try {
      installer.openSession(id).use { session ->
        apk.inputStream().use { input ->
          session.openWrite("stash.apk", 0, apk.length()).use { out ->
            input.copyTo(out, 64 * 1024)
            session.fsync(out)
          }
        }
        val callback = Intent(context, UpdateInstallReceiver::class.java).setPackage(context.packageName)
        // Mutable: the system adds the status extras to this intent.
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
          (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
        val pending = PendingIntent.getBroadcast(context, id, callback, flags)
        session.commit(pending.intentSender)
      }
    } catch (e: Exception) {
      runCatching { installer.abandonSession(id) }
      throw e
    }
  }
}

/** Receives the install session's status from the system. */
class UpdateInstallReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
    val listener = UpdateInstaller.listener
    when (status) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        @Suppress("DEPRECATION")
        val confirm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
          intent.getParcelableExtra(Intent.EXTRA_INTENT)
        }
        if (confirm == null) {
          listener?.onStatus("failed", "Android didn't show the install prompt", null)
        } else if (listener != null) {
          listener.onStatus("confirm", null, confirm)
        } else {
          UpdateInstaller.pendingConfirm = confirm
        }
      }
      PackageInstaller.STATUS_SUCCESS -> listener?.onStatus("success", null, null)
      PackageInstaller.STATUS_FAILURE_ABORTED -> listener?.onStatus("cancelled", null, null)
      else -> listener?.onStatus("failed", failureText(status, message), null)
    }
  }

  private fun failureText(status: Int, message: String?): String = when (status) {
    PackageInstaller.STATUS_FAILURE_CONFLICT ->
      "It conflicts with the installed app (signed with a different key?)"
    PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> "This update doesn't support this phone"
    PackageInstaller.STATUS_FAILURE_STORAGE -> "Not enough storage to install"
    PackageInstaller.STATUS_FAILURE_INVALID -> "The downloaded file is damaged"
    PackageInstaller.STATUS_FAILURE_BLOCKED -> "Android blocked the install"
    else -> message?.takeIf { it.isNotBlank() } ?: "Install failed"
  }
}
