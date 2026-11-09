@file:OptIn(ExperimentalMaterial3ExpressiveApi::class)

package expo.modules.expressive

import android.content.Context
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.core.content.res.ResourcesCompat
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import expo.modules.ui.UIComposableScope

@OptimizedComposeProps
data class ExpressiveThemeProps(
  /** Android font resource name registered by the expo-font config plugin. */
  val fontFamily: String = "xml_google_sans_flex",
  val modifiers: ModifierList = emptyList()
) : ComposeProps

private fun loadFontFamily(context: Context, name: String): FontFamily? {
  val id = context.resources.getIdentifier(name, "font", context.packageName)
  if (id == 0) return null
  return runCatching { ResourcesCompat.getFont(context, id) }.getOrNull()?.let { FontFamily(it) }
}

private fun Typography.withFamily(family: FontFamily): Typography {
  fun TextStyle.f() = copy(fontFamily = family)
  return copy(
    displayLarge = displayLarge.f(),
    displayMedium = displayMedium.f(),
    displaySmall = displaySmall.f(),
    headlineLarge = headlineLarge.f(),
    headlineMedium = headlineMedium.f(),
    headlineSmall = headlineSmall.f(),
    titleLarge = titleLarge.f(),
    titleMedium = titleMedium.f(),
    titleSmall = titleSmall.f(),
    bodyLarge = bodyLarge.f(),
    bodyMedium = bodyMedium.f(),
    bodySmall = bodySmall.f(),
    labelLarge = labelLarge.f(),
    labelMedium = labelMedium.f(),
    labelSmall = labelSmall.f(),
    displayLargeEmphasized = displayLargeEmphasized.f(),
    displayMediumEmphasized = displayMediumEmphasized.f(),
    displaySmallEmphasized = displaySmallEmphasized.f(),
    headlineLargeEmphasized = headlineLargeEmphasized.f(),
    headlineMediumEmphasized = headlineMediumEmphasized.f(),
    headlineSmallEmphasized = headlineSmallEmphasized.f(),
    titleLargeEmphasized = titleLargeEmphasized.f(),
    titleMediumEmphasized = titleMediumEmphasized.f(),
    titleSmallEmphasized = titleSmallEmphasized.f(),
    bodyLargeEmphasized = bodyLargeEmphasized.f(),
    bodyMediumEmphasized = bodyMediumEmphasized.f(),
    bodySmallEmphasized = bodySmallEmphasized.f(),
    labelLargeEmphasized = labelLargeEmphasized.f(),
    labelMediumEmphasized = labelMediumEmphasized.f(),
    labelSmallEmphasized = labelSmallEmphasized.f()
  )
}

/**
 * Re-provides the Host's MaterialExpressiveTheme with the brand typeface (Google Sans Flex)
 * and an explicit expressive motion scheme. Wrap a screen's Compose tree in it so every
 * Expo UI component below picks up the brand type scale.
 */
@Composable
fun FunctionalComposableScope.ExpressiveThemeContent(props: ExpressiveThemeProps) {
  val context = LocalContext.current
  val base = MaterialTheme.typography
  val typography = remember(props.fontFamily, base) {
    loadFontFamily(context, props.fontFamily)?.let { base.withFamily(it) } ?: base
  }
  MaterialExpressiveTheme(
    colorScheme = MaterialTheme.colorScheme,
    motionScheme = MotionScheme.expressive(),
    shapes = MaterialTheme.shapes,
    typography = typography
  ) {
    Children(UIComposableScope())
  }
}
