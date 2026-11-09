@file:OptIn(ExperimentalMaterial3ExpressiveApi::class)

package expo.modules.expressive

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.ButtonGroupDefaults
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Text
import androidx.compose.material3.ToggleButton
import androidx.compose.material3.ToggleButtonDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry
import expo.modules.ui.UIComposableScope
import expo.modules.ui.findChildSlotView
import expo.modules.ui.isSlotWithName
import java.io.Serializable

@OptimizedRecord
data class ButtonGroupOption(
  @Field val key: String = "",
  @Field val label: String = ""
) : Record

@OptimizedComposeProps
data class ConnectedButtonGroupProps(
  val options: List<ButtonGroupOption> = emptyList(),
  val selectedKeys: List<String> = emptyList(),
  val multiSelect: Boolean = false,
  /** Single-select only: tapping the selected button clears the selection. */
  val allowEmpty: Boolean = false,
  /** Stretch buttons to share the full width equally. */
  val fillWidth: Boolean = true,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

open class SelectionChangeEvent(
  @Field open val keys: List<String> = emptyList()
) : Record, Serializable

/**
 * M3 Expressive connected button group (replaces segmented buttons): 2dp gaps,
 * full outer corners, inner corners that tighten on press and round out when selected.
 * Optional icons are passed as `Slot`s named `icon:<key>`.
 */
@Composable
fun FunctionalComposableScope.ConnectedButtonGroupContent(
  props: ConnectedButtonGroupProps,
  onSelectionChange: (List<String>) -> Unit
) {
  var selected by remember { mutableStateOf(props.selectedKeys.toSet()) }
  LaunchedEffect(props.selectedKeys) { selected = props.selectedKeys.toSet() }

  val lastIndex = props.options.lastIndex
  Row(
    modifier = ModifierRegistry.applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher),
    horizontalArrangement = Arrangement.spacedBy(ButtonGroupDefaults.ConnectedSpaceBetween)
  ) {
    props.options.forEachIndexed { index, option ->
      val checked = option.key in selected
      val slotName = "icon:${option.key}"
      val hasIcon = findChildSlotView(view, slotName) != null
      ToggleButton(
        checked = checked,
        onCheckedChange = {
          val next = when {
            props.multiSelect -> if (checked) selected - option.key else selected + option.key
            checked && props.allowEmpty -> emptySet()
            else -> setOf(option.key)
          }
          if (next != selected) {
            selected = next
            onSelectionChange(props.options.map { it.key }.filter { it in next })
          }
        },
        modifier = (if (props.fillWidth) Modifier.weight(1f) else Modifier)
          .semantics { role = if (props.multiSelect) Role.Checkbox else Role.RadioButton },
        icon = if (hasIcon) {
          { Children(UIComposableScope(), filter = { isSlotWithName(it, slotName) }) }
        } else {
          null
        },
        shapes = when {
          lastIndex == 0 -> ToggleButtonDefaults.shapesFor(ToggleButtonDefaults.size)
          index == 0 -> ButtonGroupDefaults.connectedLeadingButtonShapes()
          index == lastIndex -> ButtonGroupDefaults.connectedTrailingButtonShapes()
          else -> ButtonGroupDefaults.connectedMiddleButtonShapes()
        }
      ) {
        if (option.label.isNotEmpty()) {
          Text(option.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
      }
    }
  }
}
