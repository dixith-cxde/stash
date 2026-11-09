@file:OptIn(ExperimentalMaterial3ExpressiveApi::class, ExperimentalMaterial3Api::class)

package expo.modules.expressive.stash

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridItemSpan
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.lazy.staggeredgrid.rememberLazyStaggeredGridState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonGroupDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialShapes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.ToggleButton
import androidx.compose.material3.ToggleButtonDefaults
import androidx.compose.material3.carousel.HorizontalMultiBrowseCarousel
import androidx.compose.material3.carousel.rememberCarouselState
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry

@OptimizedComposeProps
data class StashHomeProps(
  val title: String = "Stash",
  val subtitle: String = "",
  val collections: List<CollectionRecord> = emptyList(),
  val filters: List<OptionRecord> = emptyList(),
  val selectedFilter: String = "all",
  val items: List<CardRecord> = emptyList(),
  val emptyTitle: String = "",
  val emptyBody: String = "",
  val topInset: Float = 0f,
  val bottomInset: Float = 0f,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

/** Lets a full-width row (carousel, scrolling chips) bleed past the grid's side padding. */
private fun Modifier.bleed(horizontal: Dp) = layout { measurable, constraints ->
  val px = horizontal.roundToPx()
  val placeable = measurable.measure(
    constraints.copy(minWidth = constraints.minWidth + 2 * px, maxWidth = constraints.maxWidth + 2 * px)
  )
  layout(constraints.maxWidth, placeable.height) { placeable.place(-px, 0) }
}

/**
 * Home: big emphasized header, pill search, collections carousel, connected filter group and
 * a two-column masonry of type-specific cards. Navigation lives in the floating toolbar
 * (StashNavToolbarView) rendered by the tab layout.
 */
@Composable
fun FunctionalComposableScope.StashHomeContent(props: StashHomeProps, emit: (String, String) -> Unit) {
  val colors = MaterialTheme.colorScheme
  val gridState = rememberLazyStaggeredGridState()
  var filter by remember { mutableStateOf(props.selectedFilter) }
  LaunchedEffect(props.selectedFilter) { filter = props.selectedFilter }

  LazyVerticalStaggeredGrid(
    columns = StaggeredGridCells.Fixed(2),
    state = gridState,
    modifier = ModifierRegistry.applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher)
      .fillMaxSize(),
    contentPadding = PaddingValues(
      start = 16.dp,
      end = 16.dp,
      top = props.topInset.dp + 8.dp,
      bottom = props.bottomInset.dp + 112.dp
    ),
    verticalItemSpacing = 8.dp,
    horizontalArrangement = Arrangement.spacedBy(8.dp)
  ) {
    item(key = "header", span = StaggeredGridItemSpan.FullLine) {
      Row(
        Modifier.fillMaxWidth().padding(start = 8.dp, top = 20.dp, bottom = 4.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
      ) {
        Column(Modifier.weight(1f)) {
          Text(
            props.title,
            style = MaterialTheme.typography.displayMediumEmphasized,
            fontSize = 52.sp,
            lineHeight = 56.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = (-1.5).sp,
            modifier = Modifier.semantics { heading() }
          )
          if (props.subtitle.isNotBlank()) {
            Text(
              props.subtitle,
              style = MaterialTheme.typography.titleSmall,
              color = colors.onSurfaceVariant,
              modifier = Modifier.padding(top = 4.dp)
            )
          }
        }
        FilledTonalIconButton(
          onClick = { emit("settings", "") },
          shapes = IconButtonDefaults.shapes(),
          modifier = Modifier.size(IconButtonDefaults.mediumContainerSize())
        ) {
          StashIcon("settings_rounded", contentDescription = "Settings")
        }
      }
    }

    item(key = "search", span = StaggeredGridItemSpan.FullLine) {
      Surface(
        onClick = { emit("search", "") },
        shape = CircleShape,
        color = colors.surfaceContainerHigh,
        modifier = Modifier.fillMaxWidth().padding(top = 16.dp).height(56.dp)
      ) {
        Row(
          Modifier.padding(horizontal = 20.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
          StashIcon("search_rounded", tint = colors.onSurfaceVariant)
          Text("Search your stash", style = MaterialTheme.typography.bodyLarge, color = colors.onSurfaceVariant)
        }
      }
    }

    if (props.collections.isNotEmpty()) {
      item(key = "collections-title", span = StaggeredGridItemSpan.FullLine) {
        Row(
          Modifier.fillMaxWidth().padding(start = 8.dp, top = 20.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            "Collections",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f).semantics { heading() }
          )
          TextButton(onClick = { emit("seeAll", "") }) { Text("See all", fontWeight = FontWeight.SemiBold) }
        }
      }
      item(key = "collections", span = StaggeredGridItemSpan.FullLine) {
        CollectionsCarousel(props.collections) { emit("collection", it) }
      }
    }

    if (props.filters.size > 1) {
      item(key = "filters", span = StaggeredGridItemSpan.FullLine) {
        FilterGroup(
          options = props.filters,
          selected = filter,
          modifier = Modifier.padding(top = 20.dp, bottom = 4.dp)
        ) {
          filter = it
          emit("filter", it)
        }
      }
    }

    if (props.items.isEmpty() && props.emptyTitle.isNotBlank()) {
      item(key = "empty", span = StaggeredGridItemSpan.FullLine) {
        EmptyState(props.emptyTitle, props.emptyBody)
      }
    }

    items(props.items, key = { it.kind + ":" + it.id }) { card ->
      ItemCard(
        card,
        onClick = { emit(if (card.kind == "highlight") "highlight" else "item", card.id) },
        onLongClick = { emit(if (card.kind == "highlight") "highlightMenu" else "itemMenu", card.id) },
        modifier = Modifier.animateItem()
      )
    }
  }
}

@Composable
private fun CollectionsCarousel(collections: List<CollectionRecord>, onOpen: (String) -> Unit) {
  val state = rememberCarouselState { collections.size }
  HorizontalMultiBrowseCarousel(
    state = state,
    preferredItemWidth = 196.dp,
    itemSpacing = 8.dp,
    contentPadding = PaddingValues(horizontal = 16.dp),
    modifier = Modifier.bleed(16.dp).fillMaxWidth().height(176.dp).padding(top = 4.dp)
  ) { index ->
    val c = collections[index]
    val tone = MaterialTheme.colorScheme.tone(c.tone)
    // Fade the labels out as the item shrinks toward the carousel's small keyline.
    val info = carouselItemDrawInfo
    val labelAlpha = ((info.size / info.maxSize.coerceAtLeast(1f)) - 0.55f).div(0.3f).coerceIn(0f, 1f)
    Box(
      Modifier
        .fillMaxSize()
        .maskClip(MaterialTheme.shapes.extraLarge)
        .background(tone.container)
        .clickable(role = Role.Button) { onOpen(c.key) }
    ) {
      Box(
        Modifier
          .align(Alignment.TopEnd)
          .offset(x = 26.dp, y = (-24).dp)
          .requiredSize(132.dp)
          .clip(materialShape(c.shape).toShape())
          .background(tone.accent.copy(alpha = 0.28f))
      )
      if (c.covers.isNotEmpty()) {
        Row(Modifier.padding(start = 16.dp, top = 18.dp)) {
          c.covers.take(3).forEachIndexed { i, uri ->
            val bmp = rememberCover(uri, 200)
            val rotation = listOf(-8f, 4f, 12f)[i]
            Box(
              Modifier
                .offset(x = (-20 * i).dp)
                .rotate(rotation)
                .size(52.dp, 64.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(tone.content.copy(alpha = 0.18f))
            ) {
              if (bmp != null) Image(bmp, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            }
          }
        }
      } else {
        Box(
          Modifier
            .padding(start = 16.dp, top = 16.dp)
            .size(52.dp)
            .clip(materialShape(c.shape).toShape())
            .background(tone.accent),
          contentAlignment = Alignment.Center
        ) {
          StashIcon(c.icon, tint = tone.onAccent, size = 26.dp)
        }
      }
      Column(
        Modifier
          .align(Alignment.BottomStart)
          .padding(16.dp)
          .graphicsLayer { alpha = labelAlpha }
      ) {
        Text(
          c.title,
          style = MaterialTheme.typography.titleMedium,
          fontWeight = FontWeight.Bold,
          color = tone.content,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
        Text(
          c.subtitle,
          style = MaterialTheme.typography.labelMedium,
          color = tone.content.copy(alpha = 0.85f),
          maxLines = 1
        )
      }
    }
  }
}

/**
 * Connected button group used as a single-select filter. The selected button rounds out
 * fully and takes a larger share of the row, animated on the expressive spatial spring.
 */
@Composable
fun FilterGroup(
  options: List<OptionRecord>,
  selected: String,
  modifier: Modifier = Modifier,
  onSelect: (String) -> Unit
) {
  val scrolls = options.size > 5
  val rowModifier = if (scrolls) {
    modifier.bleed(16.dp).horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp)
  } else {
    modifier.fillMaxWidth()
  }
  Row(rowModifier, horizontalArrangement = Arrangement.spacedBy(ButtonGroupDefaults.ConnectedSpaceBetween)) {
    options.forEachIndexed { index, option ->
      val checked = option.key == selected
      val weight by animateFloatAsState(
        if (checked) 1.4f else 1f,
        MaterialTheme.motionScheme.defaultSpatialSpec(),
        label = "filterWeight"
      )
      ToggleButton(
        checked = checked,
        onCheckedChange = { if (!checked) onSelect(option.key) },
        modifier = (if (scrolls) Modifier else Modifier.weight(weight))
          .semantics { role = Role.RadioButton },
        icon = option.icon?.let { icon -> { StashIcon(icon, size = 18.dp) } },
        shapes = when (index) {
          0 -> ButtonGroupDefaults.connectedLeadingButtonShapes()
          options.lastIndex -> ButtonGroupDefaults.connectedTrailingButtonShapes()
          else -> ButtonGroupDefaults.connectedMiddleButtonShapes()
        },
        colors = ToggleButtonDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)
      ) {
        Text(option.label, maxLines = 1, overflow = TextOverflow.Clip, softWrap = false)
      }
    }
  }
}

@Composable
private fun EmptyState(title: String, body: String) {
  val colors = MaterialTheme.colorScheme
  Column(
    Modifier.fillMaxWidth().padding(top = 48.dp, start = 24.dp, end = 24.dp),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Box(
      Modifier.size(120.dp).clip(MaterialShapes.Cookie12Sided.toShape()).background(colors.primaryContainer),
      contentAlignment = Alignment.Center
    ) {
      StashIcon("bookmark_add_rounded", tint = colors.onPrimaryContainer, size = 48.dp)
    }
    Text(
      title,
      style = MaterialTheme.typography.headlineSmallEmphasized,
      fontWeight = FontWeight.Bold,
      textAlign = TextAlign.Center,
      modifier = Modifier.padding(top = 20.dp)
    )
    Text(
      body,
      style = MaterialTheme.typography.bodyLarge,
      color = colors.onSurfaceVariant,
      textAlign = TextAlign.Center,
      modifier = Modifier.padding(top = 8.dp)
    )
  }
}
