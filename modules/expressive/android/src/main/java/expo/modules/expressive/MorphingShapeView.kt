@file:OptIn(ExperimentalMaterial3ExpressiveApi::class)

package expo.modules.expressive

import android.graphics.Color
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.graphics.shapes.Morph
import androidx.graphics.shapes.toPath
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.MaterialShapeType
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry
import expo.modules.ui.UIComposableScope
import expo.modules.ui.compose

@OptimizedComposeProps
data class MorphingShapeProps(
  val shape: MaterialShapeType = MaterialShapeType.COOKIE_9_SIDED,
  /** Shape to morph into when `morphed` is true. Defaults to `shape` (rotation only). */
  val morphTo: MaterialShapeType? = null,
  val morphed: Boolean = false,
  /** Extra rotation, in degrees, applied as the morph completes. */
  val rotation: Float = 0f,
  val color: Color? = null,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

/**
 * Draws a Material 3 Expressive shape (cookie, clover, sunny…) behind its children and
 * morphs it into `morphTo` on the theme's expressive spatial spring whenever `morphed`
 * flips. Used for folder/list avatars, content-type badges and selection feedback.
 */
@Composable
fun FunctionalComposableScope.MorphingShapeContent(props: MorphingShapeProps) {
  val start = props.shape
  val end = props.morphTo ?: props.shape
  val morph = remember(start, end) {
    Morph(start.toRoundedPolygon().normalized(), end.toRoundedPolygon().normalized())
  }
  val progress by animateFloatAsState(
    targetValue = if (props.morphed) 1f else 0f,
    animationSpec = MaterialTheme.motionScheme.defaultSpatialSpec(),
    label = "morph"
  )
  val color = props.color?.compose ?: MaterialTheme.colorScheme.primaryContainer

  Box(
    modifier = ModifierRegistry.applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher)
      .drawWithCache {
        val path = morph.toPath(progress).asComposePath()
        path.transform(Matrix().apply { scale(size.width, size.height) })
        val degrees = props.rotation * progress
        onDrawBehind {
          rotate(degrees) { drawPath(path, color) }
        }
      },
    contentAlignment = Alignment.Center
  ) {
    Children(UIComposableScope(boxScope = this))
  }
}
