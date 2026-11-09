@file:OptIn(ExperimentalMaterial3ExpressiveApi::class)

package expo.modules.expressive.stash

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialShapes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.toShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Highlight swatches; kept in sync with HIGHLIGHT_SWATCH in src/theme/types.ts. */
private val SWATCH = mapOf(
  "yellow" to (0xFFFFF3B0 to 0xFF5C4E00),
  "green" to (0xFFCDEFC4 to 0xFF1E4D1A),
  "blue" to (0xFFCFE4FF to 0xFF11365C),
  "pink" to (0xFFFFD8E4 to 0xFF5C1F35),
  "purple" to (0xFFE8DDFF to 0xFF3B2A63)
)

/** (container, content) for a highlight colour in the current theme. */
@Composable
fun highlightColors(name: String?): Pair<Color, Color> {
  val (light, dark) = SWATCH[name] ?: SWATCH.getValue("yellow")
  return if (MaterialTheme.colorScheme.isDark) Color(dark) to Color(light) else Color(light) to Color(dark)
}

@Composable
private fun SourceLine(card: CardRecord, modifier: Modifier = Modifier) {
  val colors = MaterialTheme.colorScheme
  Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
    val favicon = rememberCover(card.favicon, 64)
    if (favicon != null) {
      Image(favicon, null, Modifier.size(16.dp).clip(RoundedCornerShape(5.dp)), contentScale = ContentScale.Crop)
    } else {
      Box(Modifier.size(16.dp).clip(RoundedCornerShape(5.dp)).background(colors.seededTone(card.seed).accent))
    }
    if (card.unread) Box(Modifier.size(6.dp).clip(RoundedCornerShape(3.dp)).background(colors.primary))
    Text(
      listOf(card.site, card.meta).filter { it.isNotBlank() }.joinToString(" · "),
      style = MaterialTheme.typography.labelMedium,
      color = colors.onSurfaceVariant,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis
    )
  }
}

@Composable
private fun TagRow(tags: List<String>) {
  if (tags.isEmpty()) return
  Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
    tags.take(2).forEach {
      Text(
        "#$it",
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSecondaryContainer,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier
          .clip(RoundedCornerShape(8.dp))
          .background(MaterialTheme.colorScheme.secondaryContainer)
          .padding(horizontal = 10.dp, vertical = 4.dp)
      )
    }
  }
}

@Composable
private fun CardTitle(text: String, maxLines: Int = 3) {
  Text(
    text.ifBlank { "Untitled" },
    style = MaterialTheme.typography.titleMedium,
    fontWeight = FontWeight.Bold,
    maxLines = maxLines,
    overflow = TextOverflow.Ellipsis,
    modifier = Modifier.padding(top = 6.dp)
  )
}

@Composable
private fun Badge(text: String, modifier: Modifier = Modifier) {
  Text(
    text,
    style = MaterialTheme.typography.labelMedium,
    fontWeight = FontWeight.Bold,
    color = MaterialTheme.colorScheme.onTertiaryContainer,
    modifier = modifier
      .clip(RoundedCornerShape(10.dp))
      .background(MaterialTheme.colorScheme.tertiaryContainer)
      .padding(horizontal = 10.dp, vertical = 5.dp)
  )
}

/** One masonry tile; layout and tone depend on the content type. */
@Composable
fun ItemCard(card: CardRecord, onClick: () -> Unit, onLongClick: () -> Unit, modifier: Modifier = Modifier) {
  when (card.kind) {
    "highlight" -> QuoteCard(card, onClick, onLongClick, modifier)
    "text" -> NoteCard(card, onClick, onLongClick, modifier)
    "pdf" -> PdfCard(card, onClick, onLongClick, modifier)
    "image" -> ImageCard(card, onClick, onLongClick, modifier)
    "file" -> FileCard(card, onClick, onLongClick, modifier)
    else -> LinkCard(card, onClick, onLongClick, modifier)
  }
}

@Composable
private fun LinkCard(card: CardRecord, onClick: () -> Unit, onLongClick: () -> Unit, modifier: Modifier) {
  val video = card.kind == "video"
  MorphSurface(onClick, modifier.fillMaxWidth(), onLongClick, contentDescription = card.title) {
    Column {
      Box(Modifier.fillMaxWidth().height(if (video) 112.dp else 132.dp)) {
        CoverImage(card.cover, Modifier.fillMaxSize()) {
          FallbackCover(card.seed, card.site, Modifier.fillMaxSize())
        }
        if (video) {
          Box(
            Modifier
              .align(Alignment.Center)
              .size(52.dp)
              .clip(MaterialShapes.Cookie6Sided.toShape())
              .background(MaterialTheme.colorScheme.tertiaryContainer),
            contentAlignment = Alignment.Center
          ) {
            StashIcon("play_arrow_rounded", tint = MaterialTheme.colorScheme.onTertiaryContainer)
          }
        }
        card.badge?.let { Badge(it, Modifier.align(Alignment.BottomEnd).padding(8.dp)) }
      }
      Column(Modifier.padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 16.dp)) {
        SourceLine(card)
        CardTitle(card.title)
        TagRow(card.tags)
      }
    }
  }
}

@Composable
private fun PdfCard(card: CardRecord, onClick: () -> Unit, onLongClick: () -> Unit, modifier: Modifier) {
  val colors = MaterialTheme.colorScheme
  MorphSurface(onClick, modifier.fillMaxWidth(), onLongClick, contentDescription = card.title) {
    Column {
      Box(
        Modifier.fillMaxWidth().height(176.dp).background(colors.surfaceContainerHighest),
        contentAlignment = Alignment.BottomCenter
      ) {
        val page = Modifier
          .width(118.dp)
          .height(154.dp)
          .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
          .background(Color.White)
        CoverImage(card.cover, page, widthPx = 360, alignment = Alignment.TopCenter) {
          // Stylised page while there is no rendered thumbnail.
          Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.fillMaxWidth(0.8f).height(6.dp).clip(RoundedCornerShape(3.dp)).background(Color(0xFF1D1B20)))
            Box(Modifier.fillMaxWidth(0.6f).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0xFF79747E)))
            repeat(3) { Box(Modifier.fillMaxWidth(0.94f).height(3.dp).background(Color(0xFFCAC4D0))) }
            Box(Modifier.fillMaxWidth().height(24.dp).clip(RoundedCornerShape(3.dp)).background(colors.primaryContainer))
            Box(Modifier.fillMaxWidth(0.9f).height(3.dp).background(Color(0xFFCAC4D0)))
          }
        }
        Badge(card.badge ?: "PDF", Modifier.align(Alignment.TopEnd).padding(10.dp))
      }
      Column(Modifier.padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 16.dp)) {
        CardTitle(card.title)
        Text(
          card.meta,
          style = MaterialTheme.typography.labelMedium,
          color = colors.onSurfaceVariant,
          modifier = Modifier.padding(top = 6.dp)
        )
        TagRow(card.tags)
      }
    }
  }
}

@Composable
private fun NoteCard(card: CardRecord, onClick: () -> Unit, onLongClick: () -> Unit, modifier: Modifier) {
  val colors = MaterialTheme.colorScheme
  MorphSurface(onClick, modifier.fillMaxWidth(), onLongClick, color = colors.secondaryContainer, contentDescription = card.title) {
    Column(Modifier.padding(16.dp)) {
      Text(
        "NOTE",
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.8.sp,
        color = colors.onSecondaryContainer.copy(alpha = 0.8f)
      )
      Text(
        card.title.ifBlank { "Note" },
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = colors.onSecondaryContainer,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(top = 6.dp)
      )
      if (card.body.isNotBlank()) {
        Text(
          card.body,
          style = MaterialTheme.typography.bodyMedium,
          color = colors.onSecondaryContainer.copy(alpha = 0.9f),
          maxLines = 5,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.padding(top = 4.dp)
        )
      }
      TagRow(card.tags)
    }
  }
}

@Composable
private fun QuoteCard(card: CardRecord, onClick: () -> Unit, onLongClick: () -> Unit, modifier: Modifier) {
  val (container, content) = highlightColors(card.color)
  MorphSurface(onClick, modifier.fillMaxWidth(), onLongClick, color = container, contentDescription = card.body) {
    Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 18.dp, bottom = 16.dp)) {
      StashIcon("format_quote_rounded", tint = content.copy(alpha = 0.7f), size = 28.dp)
      Text(
        card.body,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        lineHeight = 24.sp,
        color = content,
        maxLines = 8,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(top = 6.dp)
      )
      Text(
        listOf("Highlight", card.site).filter { it.isNotBlank() }.joinToString(" · "),
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.SemiBold,
        color = content.copy(alpha = 0.8f),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(top = 10.dp)
      )
    }
  }
}

@Composable
private fun ImageCard(card: CardRecord, onClick: () -> Unit, onLongClick: () -> Unit, modifier: Modifier) {
  val bitmap = rememberCover(card.cover, 640)
  val ratio = bitmap?.let { (it.width.toFloat() / it.height).coerceIn(0.6f, 1.6f) } ?: 0.8f
  MorphSurface(onClick, modifier.fillMaxWidth(), onLongClick, contentDescription = card.title) {
    Box(Modifier.fillMaxWidth().aspectRatio(ratio)) {
      CoverImage(card.cover, Modifier.fillMaxSize()) {
        FallbackCover(card.seed, card.title, Modifier.fillMaxSize())
      }
    }
  }
}

@Composable
private fun FileCard(card: CardRecord, onClick: () -> Unit, onLongClick: () -> Unit, modifier: Modifier) {
  val tone = MaterialTheme.colorScheme.seededTone(card.seed)
  MorphSurface(onClick, modifier.fillMaxWidth(), onLongClick, contentDescription = card.title) {
    Column(Modifier.padding(16.dp)) {
      Box(
        Modifier.size(52.dp).clip(MaterialShapes.Pill.toShape()).background(tone.accent),
        contentAlignment = Alignment.Center
      ) {
        StashIcon("attach_file_rounded", tint = tone.onAccent)
      }
      Spacer(Modifier.height(6.dp))
      CardTitle(card.title, maxLines = 2)
      Text(
        listOfNotNull(card.badge, card.meta.ifBlank { null }).joinToString(" · "),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 6.dp)
      )
    }
  }
}
