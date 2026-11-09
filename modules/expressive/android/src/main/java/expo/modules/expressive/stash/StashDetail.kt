@file:OptIn(ExperimentalMaterial3ExpressiveApi::class, ExperimentalLayoutApi::class)

package expo.modules.expressive.stash

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.Image
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ButtonGroup
import androidx.compose.material3.ButtonGroupDefaults
import androidx.compose.material3.ButtonShapes
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilledIconToggleButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.toShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry

@OptimizedComposeProps
data class StashDetailProps(
  val id: String = "",
  val kind: String = "link",
  val title: String = "",
  val description: String = "",
  val site: String = "",
  val seed: String = "",
  val meta: String = "",
  val cover: String? = null,
  val favicon: String? = null,
  val favorite: Boolean = false,
  val readLabel: String = "Read",
  val readIcon: String = "menu_book_rounded",
  val canRead: Boolean = true,
  val editableBody: Boolean = false,
  val body: String = "",
  val note: String = "",
  val folder: String = "No folder",
  val folderShape: String = "cookie9Sided",
  val lists: List<ChipRecord> = emptyList(),
  val tags: List<ChipRecord> = emptyList(),
  val suggestions: List<ChipRecord> = emptyList(),
  val highlights: List<HighlightRecord> = emptyList(),
  val url: String? = null,
  val loading: Boolean = false,
  val topInset: Float = 0f,
  val bottomInset: Float = 0f,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

/**
 * Item detail: full-bleed cover with rounded foot, Read / Favorite / Share button group,
 * an Organize card with suggested tags, coloured highlights and the personal note.
 */
@Composable
fun FunctionalComposableScope.StashDetailContent(props: StashDetailProps, emit: (String, String, String) -> Unit) {
  val colors = MaterialTheme.colorScheme
  Box(
    ModifierRegistry.applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher)
      .fillMaxSize()
      .background(colors.surface)
  ) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
      Hero(props)
      Column(Modifier.padding(start = 24.dp, end = 24.dp, top = 20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          val favicon = rememberCover(props.favicon, 64)
          if (favicon != null) {
            Image(favicon, null, Modifier.size(20.dp).clip(RoundedCornerShape(6.dp)), contentScale = ContentScale.Crop)
          } else {
            Box(Modifier.size(20.dp).clip(RoundedCornerShape(6.dp)).background(colors.seededTone(props.seed).accent))
          }
          Text(
            props.meta,
            style = MaterialTheme.typography.labelLarge,
            color = colors.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
          )
          if (props.loading) LoadingIndicator(Modifier.size(28.dp))
        }
        Text(
          props.title.ifBlank { "Untitled" },
          style = MaterialTheme.typography.headlineMediumEmphasized,
          fontSize = 30.sp,
          lineHeight = 36.sp,
          fontWeight = FontWeight.ExtraBold,
          letterSpacing = (-0.5).sp,
          modifier = Modifier
            .padding(top = 12.dp)
            .semantics { heading() }
            .clickable(onClickLabel = "Rename") { emit("title", "", "") }
        )
        if (props.description.isNotBlank()) {
          Text(
            props.description,
            style = MaterialTheme.typography.bodyLarge,
            color = colors.onSurfaceVariant,
            maxLines = 6,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 10.dp)
          )
        }
      }

      ActionGroup(props, emit)

      if (props.editableBody) {
        NoteField(
          key = props.id + ":body",
          label = "TEXT",
          initial = props.body,
          minHeight = 160,
          onChange = { emit("body", "", it) }
        )
      }

      OrganizeCard(props, emit)

      if (props.highlights.isNotEmpty()) {
        Row(
          Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 28.dp, bottom = 12.dp),
          verticalAlignment = Alignment.Bottom
        ) {
          Text(
            "Highlights",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f).semantics { heading() }
          )
          Text(
            props.highlights.size.toString(),
            style = MaterialTheme.typography.labelLarge,
            color = colors.onSurfaceVariant
          )
        }
        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
          props.highlights.forEach { h ->
            val (container, content) = highlightColors(h.color)
            MorphSurface(
              onClick = { emit("highlight", h.id, "") },
              onLongClick = { emit("highlightMenu", h.id, "") },
              color = container,
              radius = 24.dp,
              modifier = Modifier.fillMaxWidth()
            ) {
              Column(Modifier.padding(16.dp)) {
                Text(
                  "“${h.text}”",
                  style = MaterialTheme.typography.bodyLarge,
                  fontWeight = FontWeight.SemiBold,
                  lineHeight = 23.sp,
                  color = content
                )
                val footer = listOfNotNull(h.meta.ifBlank { null }, h.note?.ifBlank { null }?.let { "your note: $it" })
                if (footer.isNotEmpty()) {
                  Text(
                    footer.joinToString(" · "),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = content.copy(alpha = 0.8f),
                    modifier = Modifier.padding(top = 8.dp)
                  )
                }
              }
            }
          }
        }
      }

      NoteField(
        key = props.id + ":note",
        label = "YOUR NOTE",
        initial = props.note,
        placeholder = "Why did you save this?",
        minHeight = 72,
        onChange = { emit("note", "", it) }
      )

      props.url?.let { url ->
        Text(
          url,
          style = MaterialTheme.typography.bodySmall,
          color = colors.onSurfaceVariant,
          maxLines = 3,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier
            .padding(start = 24.dp, end = 24.dp, top = 20.dp)
            .clickable(onClickLabel = "Copy link") { emit("copyUrl", "", "") }
        )
      }
      Spacer(Modifier.height(props.bottomInset.dp + 40.dp))
    }
    DetailTopButtons(props, emit)
  }
}

@Composable
private fun Hero(props: StashDetailProps) {
  val colors = MaterialTheme.colorScheme
  val heroShape = RoundedCornerShape(bottomStart = 40.dp, bottomEnd = 40.dp)
  Box(Modifier.fillMaxWidth().height(props.topInset.dp + 280.dp).clip(heroShape)) {
    if (props.kind == "text" || props.kind == "highlight") {
      FallbackCover(props.seed, props.title, Modifier.fillMaxSize(), large = true)
    } else {
      CoverImage(
        props.cover,
        Modifier.fillMaxSize(),
        widthPx = 1080,
        contentScale = if (props.kind == "image" || props.kind == "pdf") ContentScale.Fit else ContentScale.Crop,
        alignment = Alignment.TopCenter
      ) {
        FallbackCover(props.seed, props.site.ifBlank { props.title }, Modifier.fillMaxSize(), large = true)
      }
    }
  }
}

/** Back / more float over the hero; rendered by the screen so they stay on top. */
@Composable
private fun DetailTopButtons(props: StashDetailProps, emit: (String, String, String) -> Unit) {
  val scrim = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f)
  Row(
    Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = props.topInset.dp + 8.dp),
    horizontalArrangement = Arrangement.SpaceBetween
  ) {
    FilledIconButton(
      onClick = { emit("back", "", "") },
      colors = IconButtonDefaults.filledIconButtonColors(containerColor = scrim, contentColor = MaterialTheme.colorScheme.onSurface),
      modifier = Modifier.size(48.dp)
    ) { StashIcon("arrow_back_rounded", contentDescription = "Back") }
    FilledIconButton(
      onClick = { emit("more", "", "") },
      colors = IconButtonDefaults.filledIconButtonColors(containerColor = scrim, contentColor = MaterialTheme.colorScheme.onSurface),
      modifier = Modifier.size(48.dp)
    ) { StashIcon("more_vert_rounded", contentDescription = "More") }
  }
}

/**
 * Standard M3 Expressive button group: the pressed button grows and pushes its neighbours,
 * the favourite toggle morphs from a rounded square to a circle when checked.
 */
@Composable
private fun ActionGroup(props: StashDetailProps, emit: (String, String, String) -> Unit) {
  val colors = MaterialTheme.colorScheme
  val height = ButtonDefaults.MediumContainerHeight
  var favorite by remember(props.id) { mutableStateOf(props.favorite) }
  LaunchedEffect(props.favorite) { favorite = props.favorite }
  val readInteraction = remember { MutableInteractionSource() }
  val favInteraction = remember { MutableInteractionSource() }
  val shareInteraction = remember { MutableInteractionSource() }

  ButtonGroup(
    overflowIndicator = { ButtonGroupDefaults.OverflowIndicator(it) },
    modifier = Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 20.dp),
    horizontalArrangement = Arrangement.spacedBy(4.dp)
  ) {
    if (props.canRead) {
      customItem(
        buttonGroupContent = {
          Button(
            onClick = { emit("read", "", "") },
            shapes = ButtonShapes(
              shape = RoundedCornerShape(topStart = 28.dp, bottomStart = 28.dp, topEnd = 12.dp, bottomEnd = 12.dp),
              pressedShape = RoundedCornerShape(10.dp)
            ),
            interactionSource = readInteraction,
            contentPadding = ButtonDefaults.contentPaddingFor(height),
            modifier = Modifier.height(height).weight(1f).animateWidth(readInteraction)
          ) {
            StashIcon(props.readIcon, size = ButtonDefaults.iconSizeFor(height))
            Spacer(Modifier.size(10.dp))
            Text(props.readLabel, style = ButtonDefaults.textStyleFor(height), maxLines = 1)
          }
        },
        menuContent = {}
      )
    }
    customItem(
      buttonGroupContent = {
        FilledIconToggleButton(
          checked = favorite,
          onCheckedChange = {
            favorite = it
            emit("favorite", "", it.toString())
          },
          shapes = IconButtonDefaults.toggleableShapes(
            shape = RoundedCornerShape(if (props.canRead) 12.dp else 28.dp),
            pressedShape = RoundedCornerShape(8.dp),
            checkedShape = CircleShape
          ),
          colors = IconButtonDefaults.filledIconToggleButtonColors(
            containerColor = colors.secondaryContainer,
            contentColor = colors.onSecondaryContainer,
            checkedContainerColor = colors.tertiaryContainer,
            checkedContentColor = colors.onTertiaryContainer
          ),
          interactionSource = favInteraction,
          modifier = Modifier.size(height).animateWidth(favInteraction)
        ) {
          StashIcon(if (favorite) "star_rounded_fill" else "star_rounded", contentDescription = "Favorite")
        }
      },
      menuContent = {}
    )
    customItem(
      buttonGroupContent = {
        FilledTonalIconButton(
          onClick = { emit("share", "", "") },
          shapes = IconButtonDefaults.shapes(
            shape = RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp, topEnd = 28.dp, bottomEnd = 28.dp),
            pressedShape = RoundedCornerShape(10.dp)
          ),
          interactionSource = shareInteraction,
          modifier = Modifier.size(height).animateWidth(shareInteraction)
        ) {
          StashIcon("share_rounded", contentDescription = "Share")
        }
      },
      menuContent = {}
    )
  }
}

@Composable
private fun OrganizeCard(props: StashDetailProps, emit: (String, String, String) -> Unit) {
  val colors = MaterialTheme.colorScheme
  Column(
    Modifier
      .padding(start = 16.dp, end = 16.dp, top = 24.dp)
      .fillMaxWidth()
      .clip(RoundedCornerShape(28.dp))
      .background(colors.surfaceContainer)
      .padding(18.dp)
      .animateContentSize(MaterialTheme.motionScheme.defaultSpatialSpec())
  ) {
    SectionLabel("ORGANIZE")
    FlowRow(
      Modifier.padding(top = 12.dp),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      // Folder: pill with the folder's shape as its avatar.
      Surface(
        onClick = { emit("folder", "", "") },
        shape = CircleShape,
        color = colors.primaryContainer,
        contentColor = colors.onPrimaryContainer
      ) {
        Row(
          Modifier.height(36.dp).padding(start = 6.dp, end = 14.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          Box(
            Modifier.size(26.dp).clip(materialShape(props.folderShape).toShape()).background(colors.onPrimaryContainer),
            contentAlignment = Alignment.Center
          ) {
            StashIcon("folder_rounded_fill", tint = colors.primaryContainer, size = 14.dp)
          }
          Text(props.folder, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
        }
      }
      props.lists.forEach { l ->
        OrganizeChip(l.label, colors.tertiaryContainer, colors.onTertiaryContainer) { emit("list", l.key, "") }
      }
      props.tags.forEach { t ->
        OrganizeChip("#${t.label}", colors.secondaryContainer, colors.onSecondaryContainer) { emit("tag", t.key, "") }
      }
      OutlinedButton(
        onClick = { emit("addTag", "", "") },
        shapes = ButtonDefaults.shapes(),
        contentPadding = ButtonDefaults.ExtraSmallContentPadding,
        modifier = Modifier.height(36.dp)
      ) {
        Text("+ Tag", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
      }
      OutlinedButton(
        onClick = { emit("addList", "", "") },
        shapes = ButtonDefaults.shapes(),
        contentPadding = ButtonDefaults.ExtraSmallContentPadding,
        modifier = Modifier.height(36.dp)
      ) {
        Text("+ List", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
      }
    }
    if (props.suggestions.isNotEmpty()) {
      FlowRow(
        Modifier.padding(top = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        itemVerticalAlignment = Alignment.CenterVertically
      ) {
        StashIcon("auto_awesome_rounded", tint = colors.primary, size = 18.dp)
        Text("Suggested:", style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
        props.suggestions.forEach { s ->
          Text(
            "#${s.label}",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            color = colors.primary,
            modifier = Modifier
              .clip(RoundedCornerShape(8.dp))
              .clickable(onClickLabel = "Add tag ${s.label}") { emit("acceptTag", s.key, s.label) }
              .padding(horizontal = 4.dp, vertical = 2.dp)
          )
        }
      }
    }
  }
}

@Composable
private fun OrganizeChip(label: String, container: androidx.compose.ui.graphics.Color, content: androidx.compose.ui.graphics.Color, onClick: () -> Unit) {
  val interaction = remember { MutableInteractionSource() }
  Surface(
    onClick = onClick,
    shape = RoundedCornerShape(12.dp),
    color = container,
    contentColor = content,
    interactionSource = interaction
  ) {
    Box(Modifier.height(36.dp).padding(horizontal = 14.dp), contentAlignment = Alignment.Center) {
      Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
  }
}

@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
  Text(
    text,
    style = MaterialTheme.typography.labelMedium,
    fontWeight = FontWeight.Bold,
    letterSpacing = 0.8.sp,
    color = MaterialTheme.colorScheme.primary,
    modifier = modifier
  )
}

/** Card-styled free text field; keeps its own state and reports every edit (JS debounces saves). */
@Composable
private fun NoteField(
  key: String,
  label: String,
  initial: String,
  minHeight: Int,
  placeholder: String = "",
  onChange: (String) -> Unit
) {
  val colors = MaterialTheme.colorScheme
  var text by remember(key) { mutableStateOf(initial) }
  Column(
    Modifier
      .padding(start = 16.dp, end = 16.dp, top = 16.dp)
      .fillMaxWidth()
      .clip(RoundedCornerShape(24.dp))
      .background(colors.surfaceContainer)
      .padding(horizontal = 18.dp, vertical = 14.dp)
  ) {
    SectionLabel(label)
    BasicTextField(
      value = text,
      onValueChange = {
        text = it
        onChange(it)
      },
      textStyle = MaterialTheme.typography.bodyLarge.copy(color = colors.onSurface, lineHeight = 22.sp),
      cursorBrush = SolidColor(colors.primary),
      modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
      decorationBox = { inner ->
        Box(Modifier.fillMaxWidth().heightIn(min = minHeight.dp)) {
          if (text.isEmpty() && placeholder.isNotEmpty()) {
            Text(placeholder, style = MaterialTheme.typography.bodyLarge, color = colors.onSurfaceVariant)
          }
          inner()
        }
      }
    )
  }
}
