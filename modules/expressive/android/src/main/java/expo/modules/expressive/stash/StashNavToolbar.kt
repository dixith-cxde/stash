@file:OptIn(ExperimentalMaterial3ExpressiveApi::class)

package expo.modules.expressive.stash

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.FloatingToolbarDefaults
import androidx.compose.material3.HorizontalFloatingToolbar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry

@OptimizedComposeProps
data class StashNavToolbarProps(
  val items: List<OptionRecord> = emptyList(),
  val selectedKey: String = "",
  val fabIcon: String = "add_rounded",
  val fabLabel: String = "Add to Stash",
  val bottomInset: Float = 0f,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

/**
 * App navigation as an M3 Expressive floating toolbar with an attached FAB. The current
 * destination expands into a labelled pill; the others collapse to icons.
 */
@Composable
fun FunctionalComposableScope.StashNavToolbarContent(props: StashNavToolbarProps, emit: (String, String) -> Unit) {
  var selected by remember { mutableStateOf(props.selectedKey) }
  LaunchedEffect(props.selectedKey) { selected = props.selectedKey }

  Box(
    ModifierRegistry.applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher)
      .fillMaxWidth()
      .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = props.bottomInset.dp + 16.dp),
    contentAlignment = Alignment.Center
  ) {
    HorizontalFloatingToolbar(
      expanded = true,
      floatingActionButton = {
        FloatingToolbarDefaults.VibrantFloatingActionButton(onClick = { emit("fab", "") }) {
          StashIcon(props.fabIcon, contentDescription = props.fabLabel, size = 28.dp)
        }
      },
      colors = FloatingToolbarDefaults.standardFloatingToolbarColors(
        toolbarContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh
      )
    ) {
      props.items.forEach { item ->
        NavPill(item, item.key == selected) {
          if (item.key != selected) {
            selected = item.key
            emit("tab", item.key)
          }
        }
      }
    }
  }
}

@Composable
private fun NavPill(item: OptionRecord, selected: Boolean, onClick: () -> Unit) {
  val colors = MaterialTheme.colorScheme
  val container by animateColorAsState(
    if (selected) colors.primaryContainer else colors.primaryContainer.copy(alpha = 0f),
    MaterialTheme.motionScheme.defaultEffectsSpec(),
    label = "navContainer"
  )
  val content by animateColorAsState(
    if (selected) colors.onPrimaryContainer else colors.onSurfaceVariant,
    MaterialTheme.motionScheme.defaultEffectsSpec(),
    label = "navContent"
  )
  Row(
    Modifier
      .height(48.dp)
      .widthIn(min = 48.dp)
      .clip(CircleShape)
      .background(container)
      .selectable(
        selected = selected,
        interactionSource = remember { MutableInteractionSource() },
        indication = ripple(),
        role = Role.Tab,
        onClick = onClick
      )
      .padding(horizontal = 12.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.Center
  ) {
    StashIcon(
      (if (selected) item.selectedIcon else null) ?: item.icon ?: "home_rounded",
      contentDescription = if (selected) null else item.label,
      tint = content
    )
    AnimatedVisibility(
      visible = selected,
      enter = expandHorizontally(MaterialTheme.motionScheme.defaultSpatialSpec()) + fadeIn(),
      exit = shrinkHorizontally(MaterialTheme.motionScheme.fastSpatialSpec()) + fadeOut()
    ) {
      Text(
        item.label,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.Bold,
        color = content,
        maxLines = 1,
        modifier = Modifier.padding(start = 8.dp, end = 4.dp)
      )
    }
  }
}
