@file:OptIn(ExperimentalMaterial3ExpressiveApi::class)

package expo.modules.expressive

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.FloatingActionButtonMenu
import androidx.compose.material3.FloatingActionButtonMenuItem
import androidx.compose.material3.Text
import androidx.compose.material3.ToggleFloatingActionButton
import androidx.compose.material3.ToggleFloatingActionButtonDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry
import expo.modules.ui.UIComposableScope
import expo.modules.ui.isSlotWithName
import java.io.Serializable

@OptimizedRecord
data class FabMenuItemRecord(
  @Field val key: String = "",
  @Field val label: String = ""
) : Record

@OptimizedComposeProps
data class FabMenuProps(
  val items: List<FabMenuItemRecord> = emptyList(),
  /** Controlled from JS when set; null leaves the menu self-managed. */
  val expanded: Boolean? = null,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

open class FabMenuItemEvent(@Field open val key: String = "") : Record, Serializable
open class FabMenuExpandedEvent(@Field open val expanded: Boolean = false) : Record, Serializable

/**
 * M3 Expressive FAB menu: a ToggleFloatingActionButton that morphs from a squircle into a
 * circle while the menu items fan out above it. The FAB icon (slot `fabIcon`) rotates 45°
 * with the checked progress, so a "+" turns into "×". Item icons are slots `icon:<key>`.
 */
@Composable
fun FunctionalComposableScope.FabMenuContent(
  props: FabMenuProps,
  onItemPress: (String) -> Unit,
  onExpandedChange: (Boolean) -> Unit
) {
  var expanded by remember { mutableStateOf(props.expanded ?: false) }
  LaunchedEffect(props.expanded) { props.expanded?.let { expanded = it } }

  fun setExpanded(value: Boolean) {
    if (value != expanded) {
      expanded = value
      onExpandedChange(value)
    }
  }

  FloatingActionButtonMenu(
    expanded = expanded,
    modifier = ModifierRegistry.applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher),
    button = {
      ToggleFloatingActionButton(
        checked = expanded,
        onCheckedChange = { setExpanded(it) }
      ) {
        // animateIcon tints + resizes the slot content along the checked progress (24dp → 20dp,
        // onPrimaryContainer → onPrimary); the rotation turns "+" into "×".
        val progress = { checkedProgress }
        Box(
          Modifier
            .graphicsLayer { rotationZ = 45f * progress() }
            .then(with(ToggleFloatingActionButtonDefaults) { Modifier.animateIcon(progress) }),
          contentAlignment = Alignment.Center
        ) {
          Children(UIComposableScope(), filter = { isSlotWithName(it, "fabIcon") })
        }
      }
    }
  ) {
    props.items.forEach { item ->
      FloatingActionButtonMenuItem(
        onClick = {
          setExpanded(false)
          onItemPress(item.key)
        },
        text = { Text(item.label) },
        icon = {
          Children(UIComposableScope(), filter = { isSlotWithName(it, "icon:${item.key}") })
        }
      )
    }
  }
}
