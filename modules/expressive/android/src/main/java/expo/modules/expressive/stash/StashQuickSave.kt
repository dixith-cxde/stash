@file:OptIn(ExperimentalMaterial3ExpressiveApi::class, ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package expo.modules.expressive.stash

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.MaterialShapes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SplitButtonDefaults
import androidx.compose.material3.SplitButtonLayout
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.toPath
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.graphics.shapes.Morph
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import kotlinx.coroutines.launch

@OptimizedComposeProps
data class StashQuickSaveProps(
  val visible: Boolean = true,
  /** link | video | pdf | text | image | file | highlight */
  val kind: String = "link",
  val heading: String = "Save to Stash",
  val subtitle: String = "",
  val title: String = "",
  val body: String = "",
  val bodyLabel: String = "",
  val cover: String? = null,
  val seed: String = "",
  val showFolders: Boolean = true,
  val folders: List<OptionRecord> = emptyList(),
  val selectedFolder: String = "",
  val tags: List<ChipRecord> = emptyList(),
  val duplicate: String? = null,
  val menu: List<OptionRecord> = emptyList(),
  val canSave: Boolean = true,
  val saving: Boolean = false,
  val saved: Boolean = false,
  val savedTitle: String = "",
  val savedBody: String = "",
  val canOpenApp: Boolean = false,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

/** A Shape that draws a [Morph] at [progress], scaled to the layout size. */
private class MorphShape(private val morph: Morph, private val progress: Float) : Shape {
  override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
    val path = morph.toPath(progress)
    path.transform(Matrix().apply { scale(size.width, size.height) })
    return Outline.Generic(path)
  }
}

/**
 * Quick-save bottom sheet: what is being saved, a connected folder picker, suggested tags and
 * a split Save button; after saving it morphs into a confirmation with Undo / View.
 */
@Composable
fun FunctionalComposableScope.StashQuickSaveContent(props: StashQuickSaveProps, emit: (String, String, String) -> Unit) {
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  val scope = rememberCoroutineScope()
  var shown by remember { mutableStateOf(true) }
  val dismiss: () -> Unit = {
    scope.launch { sheetState.hide() }.invokeOnCompletion {
      shown = false
      emit("dismiss", "", "")
    }
  }
  LaunchedEffect(props.visible) { if (!props.visible && shown) dismiss() }
  if (!shown) return

  ModalBottomSheet(
    onDismissRequest = {
      shown = false
      emit("dismiss", "", "")
    },
    sheetState = sheetState,
    containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
    shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp)
  ) {
    val motion = MaterialTheme.motionScheme
    val fadeInSpec = motion.defaultEffectsSpec<Float>()
    val scaleSpec = motion.defaultSpatialSpec<Float>()
    val fadeOutSpec = motion.fastEffectsSpec<Float>()
    AnimatedContent(
      targetState = props.saved,
      transitionSpec = { (fadeIn(fadeInSpec) + scaleIn(scaleSpec, 0.92f)).togetherWith(fadeOut(fadeOutSpec)) },
      label = "quickSave"
    ) { saved ->
      if (saved) SavedState(props, emit) else SaveForm(props, emit)
    }
  }
}

@Composable
private fun SaveForm(props: StashQuickSaveProps, emit: (String, String, String) -> Unit) {
  val colors = MaterialTheme.colorScheme
  Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 24.dp)) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
      Text(
        props.heading,
        style = MaterialTheme.typography.headlineSmallEmphasized,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = (-0.3).sp,
        modifier = Modifier.weight(1f)
      )
      if (props.canOpenApp) {
        TextButton(onClick = { emit("openApp", "", "") }) { Text("Open app", fontWeight = FontWeight.Bold) }
      }
    }

    DraftCard(props, emit)

    props.duplicate?.let { message ->
      Surface(
        onClick = { emit("viewDuplicate", "", "") },
        shape = RoundedCornerShape(20.dp),
        color = colors.tertiaryContainer,
        contentColor = colors.onTertiaryContainer,
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
      ) {
        Row(
          Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
          StashIcon("history_rounded")
          Text(message, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
          Text("View", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
        }
      }
    }

    if (props.showFolders && props.folders.isNotEmpty()) {
      SectionLabel("FOLDER", Modifier.padding(start = 8.dp, top = 18.dp, bottom = 8.dp))
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.weight(1f)) {
          FilterGroup(props.folders, props.selectedFolder) { emit("folder", it, "") }
        }
        FilledTonalIconButton(
          onClick = { emit("moreFolders", "", "") },
          shapes = IconButtonDefaults.shapes(),
          modifier = Modifier.size(40.dp)
        ) { StashIcon("create_new_folder_rounded", contentDescription = "Choose another folder", size = 20.dp) }
      }
    }

    Row(
      Modifier.padding(start = 8.dp, top = 18.dp, bottom = 8.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
      StashIcon("auto_awesome_rounded", tint = colors.primary, size = 14.dp)
      SectionLabel(if (props.tags.any { !it.selected }) "SUGGESTED TAGS" else "TAGS")
    }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      props.tags.forEach { tag -> TagToggle(tag) { emit("tag", tag.key, tag.label) } }
      OutlinedButton(
        onClick = { emit("addTag", "", "") },
        shapes = ButtonDefaults.shapes(),
        contentPadding = ButtonDefaults.ExtraSmallContentPadding,
        modifier = Modifier.height(36.dp)
      ) { Text("+ Tag", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold) }
    }

    SaveButton(props, emit)
  }
}

@Composable
private fun DraftCard(props: StashQuickSaveProps, emit: (String, String, String) -> Unit) {
  val colors = MaterialTheme.colorScheme
  var title by remember { mutableStateOf(props.title) }
  var body by remember { mutableStateOf(props.body) }
  val textStyle = MaterialTheme.typography.titleSmall.copy(color = colors.onSurface, fontWeight = FontWeight.Bold)
  Column(
    Modifier
      .padding(top = 12.dp)
      .fillMaxWidth()
      .clip(RoundedCornerShape(24.dp))
      .background(colors.surfaceContainerHigh)
      .padding(12.dp)
  ) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      val thumb = Modifier.size(64.dp).clip(RoundedCornerShape(18.dp))
      if (props.kind == "highlight" || props.kind == "text") {
        val tone = if (props.kind == "highlight") colors.tone("tertiary") else colors.tone("secondary")
        Box(thumb.background(tone.container), contentAlignment = Alignment.Center) {
          StashIcon(if (props.kind == "highlight") "format_quote_rounded" else "notes_rounded", tint = tone.content, size = 28.dp)
        }
      } else {
        CoverImage(props.cover, thumb, widthPx = 200) {
          FallbackCover(props.seed, props.subtitle.ifBlank { props.title }, Modifier.fillMaxSize())
        }
      }
      Column(Modifier.weight(1f)) {
        Text(
          props.subtitle,
          style = MaterialTheme.typography.labelMedium,
          fontWeight = FontWeight.SemiBold,
          color = colors.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
        if (props.kind != "highlight") {
          BasicTextField(
            value = title,
            onValueChange = {
              title = it
              emit("title", "", it)
            },
            textStyle = textStyle,
            maxLines = 2,
            cursorBrush = SolidColor(colors.primary),
            modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
            decorationBox = { inner ->
              Box {
                if (title.isEmpty()) Text("Title", style = textStyle.copy(color = colors.onSurfaceVariant))
                inner()
              }
            }
          )
        }
      }
    }
    if (props.bodyLabel.isNotBlank()) {
      SectionLabel(props.bodyLabel, Modifier.padding(top = 12.dp, start = 4.dp))
      BasicTextField(
        value = body,
        onValueChange = {
          body = it
          emit("body", "", it)
        },
        textStyle = MaterialTheme.typography.bodyLarge.copy(color = colors.onSurface),
        maxLines = 8,
        cursorBrush = SolidColor(colors.primary),
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(start = 4.dp, end = 4.dp, top = 4.dp)
      )
    }
  }
}

/** Tag chip that rounds out and fills when selected (shape + colour morph on the spring). */
@Composable
private fun TagToggle(tag: ChipRecord, onClick: () -> Unit) {
  val colors = MaterialTheme.colorScheme
  val corner by animateDpAsState(
    if (tag.selected) 18.dp else 10.dp,
    MaterialTheme.motionScheme.fastSpatialSpec(),
    label = "tagCorner"
  )
  val container by animateColorAsState(
    if (tag.selected) colors.secondaryContainer else colors.secondaryContainer.copy(alpha = 0f),
    MaterialTheme.motionScheme.defaultEffectsSpec(),
    label = "tagColor"
  )
  Surface(
    onClick = onClick,
    shape = RoundedCornerShape(corner),
    color = container,
    contentColor = if (tag.selected) colors.onSecondaryContainer else colors.onSurfaceVariant,
    border = if (tag.selected) null else BorderStroke(1.dp, colors.outline),
    modifier = Modifier.semantics { role = Role.Checkbox }
  ) {
    Row(
      Modifier.height(36.dp).padding(horizontal = 14.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
      if (tag.selected) StashIcon("check_rounded", size = 16.dp)
      Text("#${tag.label}", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
    }
  }
}

@Composable
private fun SaveButton(props: StashQuickSaveProps, emit: (String, String, String) -> Unit) {
  val height = SplitButtonDefaults.MediumContainerHeight
  var menuOpen by remember { mutableStateOf(false) }
  val arrowRotation by animateFloatAsState(
    if (menuOpen) 180f else 0f,
    MaterialTheme.motionScheme.defaultSpatialSpec(),
    label = "menuArrow"
  )
  Box(Modifier.padding(top = 22.dp)) {
    SplitButtonLayout(
      modifier = Modifier.fillMaxWidth(),
      leadingButton = {
        SplitButtonDefaults.LeadingButton(
          onClick = { emit("save", "", "") },
          enabled = props.canSave && !props.saving,
          shapes = SplitButtonDefaults.leadingButtonShapesFor(height),
          contentPadding = SplitButtonDefaults.leadingButtonContentPaddingFor(height),
          modifier = Modifier.fillMaxWidth().height(height)
        ) {
          if (props.saving) {
            LoadingIndicator(Modifier.size(28.dp), color = MaterialTheme.colorScheme.onPrimary)
          } else {
            StashIcon("bookmark_rounded_fill", size = ButtonDefaults.iconSizeFor(height))
          }
          Spacer(Modifier.width(10.dp))
          Text("Save", style = ButtonDefaults.textStyleFor(height), fontWeight = FontWeight.ExtraBold)
        }
      },
      trailingButton = {
        Box {
          SplitButtonDefaults.TrailingButton(
            checked = menuOpen,
            onCheckedChange = { menuOpen = it },
            enabled = props.canSave && !props.saving && props.menu.isNotEmpty(),
            shapes = SplitButtonDefaults.trailingButtonShapesFor(height),
            contentPadding = SplitButtonDefaults.trailingButtonContentPaddingFor(height),
            modifier = Modifier.height(height)
          ) {
            StashIcon(
              "expand_more_rounded",
              contentDescription = "More save options",
              size = ButtonDefaults.iconSizeFor(height),
              modifier = Modifier.rotate(arrowRotation)
            )
          }
          DropdownMenu(
            expanded = menuOpen,
            onDismissRequest = { menuOpen = false },
            shape = RoundedCornerShape(20.dp),
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
          ) {
            props.menu.forEach { item ->
              DropdownMenuItem(
                text = { Text(item.label, style = MaterialTheme.typography.labelLarge) },
                leadingIcon = item.icon?.let { icon -> { StashIcon(icon, size = 20.dp) } },
                onClick = {
                  menuOpen = false
                  emit("menu", item.key, "")
                }
              )
            }
          }
        }
      }
    )
  }
}

@Composable
private fun SavedState(props: StashQuickSaveProps, emit: (String, String, String) -> Unit) {
  val colors = MaterialTheme.colorScheme
  val morph = remember { Morph(MaterialShapes.Circle, MaterialShapes.Cookie9Sided) }
  val progress = remember { Animatable(0f) }
  val spin = remember { Animatable(-90f) }
  val spatial = MaterialTheme.motionScheme.slowSpatialSpec<Float>()
  LaunchedEffect(Unit) {
    launch { progress.animateTo(1f, spatial) }
    spin.animateTo(0f, spatial)
  }
  Column(
    Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 12.dp, bottom = 32.dp),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Box(
      Modifier
        .size(120.dp)
        .rotate(spin.value)
        .clip(MorphShape(morph, progress.value))
        .background(colors.primary),
      contentAlignment = Alignment.Center
    ) {
      StashIcon("check_rounded", tint = colors.onPrimary, size = 56.dp, modifier = Modifier.rotate(-spin.value))
    }
    Text(
      props.savedTitle,
      style = MaterialTheme.typography.headlineSmallEmphasized,
      fontWeight = FontWeight.ExtraBold,
      textAlign = TextAlign.Center,
      modifier = Modifier.padding(top = 16.dp)
    )
    if (props.savedBody.isNotBlank()) {
      Text(
        props.savedBody,
        style = MaterialTheme.typography.bodyMedium,
        color = colors.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 6.dp)
      )
    }
    Row(Modifier.padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      OutlinedButton(onClick = { emit("undo", "", "") }, shapes = ButtonDefaults.shapes()) {
        Text("Undo", fontWeight = FontWeight.Bold)
      }
      Button(onClick = { emit("view", "", "") }, shapes = ButtonDefaults.shapes()) {
        Text("View item", fontWeight = FontWeight.Bold)
      }
    }
  }
}
