@file:OptIn(ExperimentalMaterial3ExpressiveApi::class)

package expo.modules.expressive.stash

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.LruCache
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialShapes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ripple
import androidx.compose.material3.toShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.graphics.shapes.RoundedPolygon
import expo.modules.ui.MaterialShapeType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.math.abs

/* --------------------------------- Icons ---------------------------------- */

/**
 * Material Symbols Rounded drawable by file name (e.g. "link_rounded"), synced from
 * assets/icons by the module's build.gradle.
 */
@SuppressLint("DiscouragedApi")
@Composable
fun StashIcon(
  name: String,
  modifier: Modifier = Modifier,
  contentDescription: String? = null,
  tint: Color = LocalContentColor.current,
  size: Dp = 24.dp
) {
  val context = LocalContext.current
  val id = remember(name) { context.resources.getIdentifier(name, "drawable", context.packageName) }
  if (id == 0) return
  Icon(painterResource(id), contentDescription, modifier.size(size), tint = tint)
}

/* --------------------------------- Shapes --------------------------------- */

fun materialShape(name: String?): RoundedPolygon =
  (MaterialShapeType.entries.firstOrNull { it.value == name } ?: MaterialShapeType.COOKIE_9_SIDED)
    .toRoundedPolygon()

private val FALLBACK_SHAPES by lazy {
  listOf(
    MaterialShapes.Cookie9Sided, MaterialShapes.Clover4Leaf, MaterialShapes.SoftBurst,
    MaterialShapes.Cookie12Sided, MaterialShapes.Sunny, MaterialShapes.Clover8Leaf,
    MaterialShapes.Cookie6Sided, MaterialShapes.Flower
  )
}

fun stableHash(seed: String): Int = seed.fold(7) { h, c -> h * 31 + c.code }

/* ------------------------------ Color roles ------------------------------- */

data class Tone(val container: Color, val content: Color, val accent: Color, val onAccent: Color)

fun ColorScheme.tone(role: String): Tone = when (role) {
  "secondary" -> Tone(secondaryContainer, onSecondaryContainer, secondary, onSecondary)
  "tertiary" -> Tone(tertiaryContainer, onTertiaryContainer, tertiary, onTertiary)
  "neutral" -> Tone(surfaceContainerHighest, onSurface, onSurfaceVariant, surface)
  else -> Tone(primaryContainer, onPrimaryContainer, primary, onPrimary)
}

val ColorScheme.isDark: Boolean get() = surface.luminance() < 0.5f

/**
 * A stable tonal family for a domain or title, so items without artwork still get a
 * distinct, recognisable cover. Hue comes from the seed; tone steps follow M3 container roles.
 */
fun ColorScheme.seededTone(seed: String): Tone {
  val hue = (abs(stableHash(seed)) % 360).toFloat()
  return if (isDark) {
    Tone(
      container = Color.hsl(hue, 0.42f, 0.20f),
      content = Color.hsl(hue, 0.85f, 0.84f),
      accent = Color.hsl(hue, 0.42f, 0.31f),
      onAccent = Color.hsl(hue, 0.85f, 0.90f)
    )
  } else {
    Tone(
      container = Color.hsl(hue, 0.62f, 0.89f),
      content = Color.hsl(hue, 0.55f, 0.24f),
      accent = Color.hsl(hue, 0.55f, 0.80f),
      onAccent = Color.hsl(hue, 0.55f, 0.18f)
    )
  }
}

/* ------------------------------ Fallback art ------------------------------ */

/** "theverge.com" → "theverge"; keeps the label readable as a wordmark. */
fun wordmarkFor(label: String): String {
  val trimmed = label.trim().removePrefix("www.")
  if (trimmed.contains(' ') || !trimmed.contains('.')) return trimmed
  return trimmed.substringBeforeLast('.')
}

/**
 * Offline cover: a big tonal Material shape bleeding off the corner plus the site's
 * wordmark (or initial). Deterministic per seed, so the same site always looks the same.
 */
@Composable
fun FallbackCover(seed: String, label: String, modifier: Modifier = Modifier, large: Boolean = false) {
  val tone = MaterialTheme.colorScheme.seededTone(seed.ifEmpty { label })
  val hash = stableHash(seed.ifEmpty { label })
  val shape = FALLBACK_SHAPES[abs(hash) % FALLBACK_SHAPES.size].toShape()
  val accentShape = FALLBACK_SHAPES[abs(hash / 7) % FALLBACK_SHAPES.size].toShape()
  val word = wordmarkFor(label)
  val useWord = word.length in 2..18
  Box(modifier.background(tone.container).clipToBounds()) {
    Box(
      Modifier
        .requiredSize(if (large) 380.dp else 180.dp)
        .offset(if (large) (-90).dp else (-34).dp, if (large) (-40).dp else (-24).dp)
        .rotate((hash % 40).toFloat())
        .clip(shape)
        .background(tone.accent)
    )
    if (large) {
      Box(
        Modifier
          .align(Alignment.BottomEnd)
          .offset(24.dp, 36.dp)
          .requiredSize(150.dp)
          .rotate((hash % 25).toFloat())
          .clip(accentShape)
          .background(tone.content.copy(alpha = 0.85f))
      )
    }
    BasicText(
      text = if (useWord) word else (word.firstOrNull()?.uppercase() ?: "•"),
      style = TextStyle(color = tone.content, fontWeight = FontWeight.ExtraBold, letterSpacing = (-1).sp),
      maxLines = 2,
      autoSize = TextAutoSize.StepBased(
        minFontSize = 18.sp,
        maxFontSize = if (large) 60.sp else if (useWord) 38.sp else 72.sp
      ),
      modifier = Modifier
        .align(if (large) Alignment.BottomStart else Alignment.BottomEnd)
        .padding(horizontal = if (large) 24.dp else 14.dp, vertical = if (large) 28.dp else 10.dp)
    )
  }
}

/* --------------------------------- Images --------------------------------- */

/**
 * Small image pipeline for covers: http(s) responses are cached on disk, every source is
 * decoded with inSampleSize close to the requested width and kept in an in-memory LRU.
 */
object CoverLoader {
  private val memory = object : LruCache<String, ImageBitmap>(
    (Runtime.getRuntime().maxMemory() / 8 / 1024).toInt()
  ) {
    override fun sizeOf(key: String, value: ImageBitmap) = value.width * value.height * 4 / 1024
  }

  private fun key(uri: String, width: Int) = "$uri@${(width + 255) / 256}"

  fun cached(uri: String, width: Int): ImageBitmap? = memory.get(key(uri, width))

  suspend fun load(context: Context, uri: String, width: Int): ImageBitmap? {
    memory.get(key(uri, width))?.let { return it }
    return withContext(Dispatchers.IO) {
      runCatching { decode(context, uri, width) }.getOrNull()?.asImageBitmap()?.also {
        memory.put(key(uri, width), it)
      }
    }
  }

  private fun decode(context: Context, uri: String, width: Int): Bitmap? {
    val open: () -> InputStream? = when {
      uri.startsWith("http://") || uri.startsWith("https://") -> {
        val file = diskCached(context, uri) ?: return null
        { file.inputStream() }
      }
      uri.startsWith("content://") -> { { context.contentResolver.openInputStream(Uri.parse(uri)) } }
      else -> {
        val path = Uri.parse(uri).path ?: uri
        { File(path).takeIf { it.exists() }?.inputStream() }
      }
    }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open()?.use { BitmapFactory.decodeStream(it, null, bounds) } ?: return null
    if (bounds.outWidth <= 0) return null
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= width) sample *= 2
    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    return open()?.use { BitmapFactory.decodeStream(it, null, opts) }
  }

  private fun diskCached(context: Context, url: String): File? {
    val dir = File(context.cacheDir, "stash-covers").apply { mkdirs() }
    val name = MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    val file = File(dir, name)
    if (file.length() > 0) return file
    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
      connectTimeout = 10_000
      readTimeout = 15_000
      instanceFollowRedirects = true
      setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) Stash")
    }
    try {
      if (conn.responseCode !in 200..299) return null
      val tmp = File(dir, "$name.part")
      conn.inputStream.use { input -> tmp.outputStream().use { input.copyTo(it) } }
      return if (tmp.renameTo(file)) file else null
    } finally {
      conn.disconnect()
    }
  }
}

@Composable
fun rememberCover(uri: String?, widthPx: Int = 640): ImageBitmap? {
  val context = LocalContext.current
  val bitmap by produceState(
    initialValue = uri?.let { CoverLoader.cached(it, widthPx) },
    uri,
    widthPx
  ) {
    value = uri?.takeIf { it.isNotBlank() }?.let { CoverLoader.load(context.applicationContext, it, widthPx) }
  }
  return bitmap
}

/** Shows the image at [uri] (fading in when it arrives) or [fallback] when there is none or it fails. */
@Composable
fun CoverImage(
  uri: String?,
  modifier: Modifier = Modifier,
  widthPx: Int = 640,
  contentScale: ContentScale = ContentScale.Crop,
  alignment: Alignment = Alignment.Center,
  fallback: @Composable BoxScope.() -> Unit
) {
  val bitmap = rememberCover(uri, widthPx)
  val alpha by animateFloatAsState(
    if (bitmap != null) 1f else 0f,
    MaterialTheme.motionScheme.defaultEffectsSpec(),
    label = "coverFade"
  )
  Box(modifier.clipToBounds()) {
    if (bitmap == null || alpha < 1f) fallback()
    if (bitmap != null) {
      Image(
        bitmap,
        contentDescription = null,
        contentScale = contentScale,
        alignment = alignment,
        modifier = Modifier.matchParentSize().graphicsLayer { this.alpha = alpha }
      )
    }
  }
}

/* --------------------------------- Press ---------------------------------- */

/**
 * Container whose corners tighten and scale dips on press, on the expressive spatial spring:
 * the M3 Expressive "shape morph on interaction" for cards and tiles.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MorphSurface(
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  onLongClick: (() -> Unit)? = null,
  color: Color = MaterialTheme.colorScheme.surfaceContainer,
  radius: Dp = 28.dp,
  pressedRadius: Dp = 14.dp,
  contentDescription: String? = null,
  content: @Composable BoxScope.() -> Unit
) {
  val interaction = remember { MutableInteractionSource() }
  val pressed by interaction.collectIsPressedAsState()
  val corner by animateDpAsState(
    if (pressed) pressedRadius else radius,
    MaterialTheme.motionScheme.fastSpatialSpec(),
    label = "corner"
  )
  val scale by animateFloatAsState(
    if (pressed) 0.97f else 1f,
    MaterialTheme.motionScheme.fastSpatialSpec(),
    label = "scale"
  )
  val shape: Shape = RoundedCornerShape(corner)
  Box(
    modifier
      .graphicsLayer {
        scaleX = scale
        scaleY = scale
      }
      .clip(shape)
      .background(color)
      .combinedClickable(
        interactionSource = interaction,
        indication = ripple(),
        onClickLabel = contentDescription,
        onLongClick = onLongClick,
        onClick = onClick
      ),
    content = content
  )
}
