# Material 3 Expressive — design reference for Stash

What M3 Expressive (M3E) is, the rules it sets, and what each part means for Stash. Written for
reuse: read this before any UI work. Motion has its own doc (`docs/animation.md`); this file
covers everything else and only summarizes motion.

**Sources** (read 2026-11-14):

- m3.material.io pages, read through a real browser (the site is JS-only, so plain fetching fails):
  get-started, blog "Start building with M3 Expressive" (May 2025), styles/shape (overview,
  corner-radius-scale, shape-morph), styles/typography (overview, fonts, applying-type,
  editorial-treatments), styles/color (overview, roles), components: buttons, button-groups,
  icon-buttons, split-button, FAB, FAB menu, toolbars, navigation-bar (+specs), app-bars,
  loading-indicator, progress-indicators, lists (+specs), menus, search, cards.
- design.google "Expressive Design: Google's UX Research".
- AndroidX Compose material3 source (`androidx-main`) for exact numbers: see
  [Appendix A](#appendix-a--exact-tokens-from-androidx). Guidance text on m3.material.io
  describes intent; numbers come from the source.

---

## 1. What M3 Expressive is

- An **expansion of Material 3**, not "M4". M3 is not deprecated; M3E adds components, styles
  and design tactics "for creating emotionally impactful UX".
- Google's most researched update: 46 studies, 18,000+ participants. Findings: preferred by all
  ages (up to 87% among 18–24), rated more playful/energetic/friendly/modern, and **key UI
  elements were found up to 4× faster**. Older users located key elements as fast as younger
  ones. The gains come from **size, color, shape and containment that point at what matters**,
  not from decoration.
- Caveat from the research: expressive must not break familiar patterns. A playlist laid out as
  scattered album art looked exciting but scored worse on usability. **Keep lists as lists.**

The parts of the update:

| Area | What's new |
| --- | --- |
| Components | 14–15 new or updated: app bars, **button groups** (new), common buttons, extended FAB, **FAB menu** (new), FABs, icon buttons, **loading indicator** (new), navigation bar, navigation rail, progress indicators, sliders, **split button** (new), **toolbars** (new). Later: **expressive lists** (Dec 2025), **vertical menus** (Nov 2025). |
| Motion | Spring physics system: spatial (bouncy) vs effects (no bounce) springs. → `docs/animation.md` |
| Type | 30 styles: 15 baseline + **15 emphasized**. Editorial treatments with variable fonts. |
| Shape | Corner scale grows to 10 steps; **35-shape library**; built-in **shape morphing**. |
| Color | Vibrant schemes, 3 contrast levels; richer use of secondary/tertiary for hierarchy. |

## 2. The seven expressive tactics

These are how Google itself applies M3E. Each is one axis of expressiveness; screens combine them.

1. **Use a variety of shapes.** Mix round and square for tension and contrast. Break from the
   surrounding shape style to draw attention to one element. *Caution: smaller shapes make
   essential actions look less important.*
2. **Apply rich, nuanced color.** Use contrast between primary / secondary / tertiary roles and
   surface tones to rank actions. *Without contrast, elements blend together.*
3. **Guide attention with typography.** Emphasized styles for headlines and key actions.
   Heavier weight, larger size, color and spacing create "editorial" moments.
4. **Contain content for emphasis.** Group related content into containers; give the most
   important content the most space and the brightest surface. *Ungrouped info blends together.*
5. **Add fluid, natural motion.** Shape morphs, surface effects, expressive springs.
6. **Leverage component flexibility.** Components and controls adapt to context (size, layout).
7. **Combine tactics into hero moments.** One or two per product, on the key interactions.
   Too many hero moments overwhelm. Ask: is it emotionally impactful? Is it a key interaction?

Research example worth copying: an email app's Send button made **larger, placed near the
thumb, in a secondary color** was found 4× faster than a small Send icon in the top bar.

## 3. Shape

### Corner radius scale (10 steps)

| Token | dp | Typical use |
| --- | --- | --- |
| none | 0 | docked toolbar, app bar container |
| extraSmall | 4 | inner corners of grouped items (lists, menus) |
| small | 8 | chips, inner corners of connected buttons |
| medium | 12 | cards (default), small FAB |
| large | 16 | FAB, list group outer corners, selected list item |
| largeIncreased | 20 | *new in M3E* |
| extraLarge | 28 | dialogs, sheets top, large FAB |
| extraLargeIncreased | 32 | *new in M3E* |
| extraExtraLarge | 48 | *new in M3E*, hero containers |
| full | pill | buttons (round), icon buttons, search bar, floating toolbar |

`full` is now a real token (previously "50% of component size").

### Rules

- **Inner corners**: tightly grouped items (menus, split buttons, connected button groups,
  segmented lists) use small corners where items meet and the group's outer radius on the ends.
  Inner-corner tokens always map to individual corner tokens.
- **Optical roundness**: nested shapes must not reuse the parent radius.
  `inner radius = outer radius − padding` (48 − 14 = 34). Applies to every card-with-thumbnail.
- **Do not put large or full corners on information-dense containers** (e.g. text-heavy cards).
  Shapes "can be intentionally rounder to add visual variety"; "switch between square and fully
  rounded shapes" for unexpected moments.
- Components may be remapped to another step (e.g. buttons from full → medium) if done consistently.

### The shape library (35 shapes) and morphing

- Use abstract shapes **sparingly**, mostly on **visual / decorative / non-interactive**
  elements: image crops, avatars, thumbnails, empty states, loading. Avoid them on text-heavy
  containers. Shapes "without clear meaning … add more visual clutter than delight".
- **Shape is versatile, not semantic**: don't assign a fixed meaning to one shape.
- **Morph to communicate**: interaction states (selected), actions in progress (loading,
  typing), environment changes. Morphs use the expressive motion scheme by default.
- M3 itself uses morphing in exactly two places: **standard button group** (press/select) and
  the **loading indicator** (a looping morph through 7 shapes).
- Shape can feel 2.5D: different motion per layer gives depth.
- Stash rule: never `puffy` or `heart` (AGENTS.md).

## 4. Typography

- Type scale = 5 roles (display, headline, title, body, label) × 3 sizes = 15 baseline styles,
  plus **15 emphasized** twins (same size, heavier weight). Exact values: Appendix A.
- Emphasized styles mark highlighted moments: headlines, key actions ("Begin recording"),
  unread state, selected items.
- Roles: **display** = short, important text/numerals, best on large screens; **headline** =
  short high-emphasis text on small screens; **title** = medium emphasis, short (app bar titles,
  section headers); **body** = long passages (no expressive fonts); **label** = text inside
  components (buttons use label large), captions, nav labels.
- Line height ≈ 1.2× size for title/headline/display, ≈ 1.5× for body/label.
- Use **tabular figures** for changing numbers (counters, timers, page "2 of 21").
- Text color defaults to `onSurface`, alternative `onSurfaceVariant`. Links: `primary`
  (or `tertiary` for less prominent), always underlined.
- Contrast: 4.5:1 small text, 3:1 large text.
- App bar headline styles: small = title large; **medium flexible = headline medium; large
  flexible = display small**. Subtitles: small = label medium, medium = label large, large = title medium.

### Fonts

- Roboto is the default; Roboto Flex/Serif/Mono are variable options. Google's own M3E apps use
  **Google Sans Flex** (now open source, 6 axes incl. roundness `ROND`). Its roundness echoes the
  shape library: "shapes and Google Sans Flex share roundness visual attributes". Stash already
  ships Google Sans Flex (ROND 50) — keep it.
- Fallback chain for variable fonts: Flex → Roboto → Noto Sans.

### Editorial treatments

- Standalone, type-driven showcase moments: custom large sizes, blocky type. They "should depart
  from purely functional layouts". Uses: celebrating content, voice of the user, bespoke function.
- Guard rails: make tokens for each treatment and reuse them; match emotional tone to the task;
  don't mix clashing treatments in one layout; **never use editorial treatments for labels or
  plain information**.
- Variable axes: weight (no very light weights for body; no excessive weight at small sizes),
  grade (counteract dark-mode bloom with negative grade), width (narrow for labels, never wide
  in an app bar), optical size (match it to the size).

## 5. Color

- 26 standard roles in six groups (primary, secondary, tertiary, error, surface, outline) plus
  add-ons (fixed / fixed dim). Pairs guarantee ≥ 3:1 contrast; **only use intended pairs**
  (`primary`/`onPrimary`, `secondaryContainer`/`onSecondaryContainer`, …). Containers are fills
  only, never text.
- **Primary**: most important actions and active states (FAB, filled button).
  **Secondary**: less urgent elements — selected nav indicator, tonal buttons, filter chips.
  **Tertiary**: small elements needing special attention (badges, highlighted input,
  vibrant menus, contrasting accents). Use contrast between the three to rank.
- **Surface**: `surface` for backgrounds; five containers (lowest → highest) for hierarchy and
  nesting. Common pairing: `surface` for the body, `surfaceContainer` for navigation areas.
  Text on any surface: `onSurface` / `onSurfaceVariant`.
- **Outline** for important boundaries (text field); **outlineVariant** for dividers and
  decorative borders. Never `outline` for dividers or multi-element containers like cards.
- **Inverse** roles: snackbar (`inverseSurface`, `inverseOnSurface`, `inversePrimary` action).
- M3E: three contrast levels (standard / medium / high); light-theme `on*Container` roles are
  more colorful (Aug 2024).
- Contrast rule for containers on containers: use surface steps **more than one step apart**
  (e.g. search bar `surfaceContainerHigh` must not sit on `surfaceContainer`).

## 6. Components

Numbers below are from the guidelines; full token tables in Appendix A.

### Buttons
- Five sizes **XS 32 / S 40 (default) / M 56 / L 96 / XL 136 dp**; two shapes: **round**
  (full) and **square** (radius grows with size). Five color styles in emphasis order:
  elevated, **filled** (≈ one per screen, final actions like Save), tonal (secondary
  container), outlined (alternative actions), text (lowest; dialogs, cards, snackbars).
- **Press = shape morph**: corner radius tightens while pressed (both shapes).
- **Toggle buttons**: unselected → selected changes **shape (round ↔ square)** and color; icon
  goes outlined → filled (or semibold if no filled glyph). Keep label length similar.
- Label: sentence case, 1–3 words, never truncated or wrapped. Icon leading, max one icon.
- Hierarchy through size: the primary action can be a bigger button than its neighbours.

### Icon buttons
- Same five sizes (XS 32, **S 40 default**, M 56, L 96, XL 136) × three widths
  (**narrow, default, wide**), round or square. Styles: filled > tonal > outlined > standard.
- Default icon buttons use **filled** icons. Toggle: outlined → filled; selected must differ in
  ≥ 2 properties (not color alone).
- Wide icon buttons are the M3E way to emphasise one action in an app bar or toolbar.

### Button groups (new)
- **Standard group**: buttons react to each other. Pressing one **widens it and squeezes its
  neighbours** temporarily; selection changes **shape** (round↔square) and color. Container has
  padding so animation doesn't move the layout; it hugs its content. Same size and shape for all
  buttons by default; vary width and color instead.
- **Connected group**: replaces the **segmented button (no longer recommended)**. For single /
  multi select, view switching, sorting. Spans the width of its surface (cap width on large
  screens). Pressing changes only the pressed button's shape. Selected = shape change to round.
  Don't mix color styles inside it. Only use it when buttons can be toggled.
- Never wrap groups to a second line; overflow trailing items into a menu instead.

### Split button (new)
- Leading button (1–2 words + icon) + trailing chevron button; sizes XS–XL. Trailing button
  rotates its chevron 180° inward and **morphs shape** when open; uses the **standard** motion
  scheme for that rotation. Menu aligns to the trailing button, 4dp away.

### FAB / extended FAB / FAB menu
- FAB sizes: **FAB (56), medium FAB (new, 80), large FAB (96)**; small FAB no longer recommended;
  surface-colored FABs no longer recommended. Color styles: primary/secondary/tertiary and their
  containers.
- FAB sits right-aligned **above** the navigation bar, never covering it.
- **FAB menu** (new): opens from a FAB only, 2–6 related items, each with icon + label, all
  fully rounded, hugging content. The FAB transforms into the menu's **close button**; items
  enter from the FAB's top trailing corner. Color set matches the FAB (primary/secondary/tertiary).
  **Don't use a FAB menu when the FAB is paired with a toolbar or navigation rail.** Items can
  container-transform into the destination screen.

### Toolbars (new; replace the bottom app bar)
- **Docked**: full width, square corners, bottom only, global actions; never with a nav bar.
- **Floating**: pill container floating above content, contextual actions for this page;
  ≥ 16dp from window edges; elevated by default. Horizontal on phones, vertical (24dp margin)
  on large screens.
- Color: **standard** (low emphasis, surface container) or **vibrant** (high emphasis, primary
  container; also signals a mode like editing).
- Slots hold icon buttons, buttons, text fields, anything. **Emphasise one action only**: a
  filled/wide icon button, or a FAB beside the toolbar. No square buttons in a floating toolbar.
- **Nav bar on primary pages, toolbar on subsequent pages.** Never both at once.

### Navigation bar (flexible)
- The baseline nav bar is replaced by the **flexible navigation bar: shorter (64dp)**, full
  width, `surfaceContainer`, docked at the bottom. 3–5 destinations, **every item has a label**
  (1–2 words, never truncated). Compact windows: vertical items (pill indicator around the icon,
  label below); medium windows: horizontal items (icon + label inside the pill).
- Active: indicator `secondaryContainer`, icon `onSecondaryContainer`, **filled** icon; inactive
  icons outlined, `onSurfaceVariant`; label of active item `secondary`. Badges optional.
- Not for desktop/expanded windows (use a rail).

### App bars
- Variants: **search app bar** (home pages where search is key), **small**, **medium
  flexible**, **large flexible** (baseline medium/large deprecated). Flexible bars show a larger
  headline (wraps to 2 lines max, never truncated) and **collapse to the small bar on scroll**.
  Optional subtitle.
- Container: full width, straight corners, default height. Leading: back or menu. Trailing:
  **at most two** icon buttons; one may be filled/tonal (and wide) to boost the primary action.
  More actions belong in a toolbar, not an overflow.
- Search app bar: search field fills the space up to 312dp, then 50%; up to 2 trailing icons +
  avatar on phones; hint text includes the word "Search".

### Lists (expressive, Dec 2025)
- Two styles: **standard** and **segmented**. Segmented = each item is its own filled
  container separated by small gaps, with **16dp outer corners and 4dp inner corners**; a
  **selected item morphs to 16dp on all corners** and takes `primaryContainer` /
  `onPrimaryContainer`.
- **Use gaps for contained lists** (expressive containment); limit dividers to uncontained or
  complex lists. Search suggestions/results use gaps to separate groups.
- Slots: leading (icon, avatar, image, selection control), content (label + supporting text,
  largest), trailing (text, icon, icon button, control). One selection interaction per item.
  Heights by tallest element: 56 / 72 / 88dp; top-align when ≥ 88dp or 3+ lines.
- Leading avatars may use circular **or expressive shapes** for people/entities; square or
  rectangular images for content.
- Lists may expand/collapse and swipe to reveal actions.

### Menus (vertical menus, Nov 2025)
- New vertical menus with expressive shapes, **standard** (surface) or **vibrant** (tertiary)
  color, selection states, **gaps** between groups (1–2 gaps max, not in scrolling menus).
  Slots for swatches/images. On compact screens a bottom sheet can replace a menu.
- Opens with an enter transition from its trigger; trigger shows pressed while open.

### Loading & progress
- Wait < 200ms: nothing. **200ms–5s: loading indicator.** > 5s: progress indicator.
  Never turn a loading indicator into a determinate progress bar.
- **Loading indicator**: looping morph through 7 shapes; default 48dp (24–240); optional
  circular container (use over content and for pull-to-refresh), which switches the indicator
  color from `primary` to `onPrimaryContainer`. Center it in the area that's loading; can sit
  inside buttons.
- **Progress indicators** (linear and circular): configurable track height and an optional
  **wavy** active track; rounded ends, gap between active and track, end **stop indicator**.

### Search
- Search bar: `surfaceContainerHigh`, full corners, leading search icon or nav button, ≤ 2
  trailing icons (or avatar + 1). Focused search shows suggestions/results as a list, grouped
  with gaps; docked (scrim) or full screen. Margins 24dp unfocused, 12dp focused.

### Cards
- Elevated / filled / outlined are a style choice. Cards are for single-subject content and
  entry points; **don't force content into cards** where spacing/headlines would do. Text on
  images needs a scrim or bounding shape.

## 7. Motion (summary — details in `docs/animation.md`)

Springs everywhere. **Spatial** springs (bounce) for position/size/shape; **effects** springs
(no bounce) for color/opacity. Fast for small, finger-driven changes; default for medium;
slow for full-screen. Expressive scheme by default; standard scheme for reduced motion and a
few utilitarian cases (split-button chevron rotation).

---

## 8. Stash audit (2026-11-14) — where we are vs M3E

Screenshots of Home, Library, Feeds and Search on the phone were reviewed against the above.

**Already on target**
- Google Sans Flex with large, heavy display titles; spring tokens + `usePressMorph` press morph;
  10-step corner scale in `src/theme/tokens.ts`; expressive button/icon-button sizes; morphing
  `LoadingIndicator`; collection cards with tonal colors and decorative shapes; pill search bar;
  ButtonGroup with UI-thread selection; split button; container-transform transitions.

**Gaps (ordered by visual impact)**

1. **Navigation bar**: ours is a floating, icon-only pill with the FAB beside it. M3E's flexible
   nav bar is docked, full width, 64dp, `surfaceContainer`, **labels required**, FAB above it on
   the right. (A floating pill is the *toolbar* pattern, meant for contextual page actions.)
2. **Lists aren't expressive lists**: Library smart views, feed rows, settings rows, related
   links, search results are separate cards/rows. M3E wants **segmented groups** — one filled
   group, small gaps, 16dp outer / 4dp inner corners, selected item morphs to 16dp.
3. **Segmented controls**: Feeds "New / All / Saved" and Home/Search "All / Links / PDFs / Notes"
   should be **connected button groups** (inner corners small, outer full, selected morphs to
   round + `secondaryContainer`) or expressive **filter chips** (12dp at rest, full when selected, 8dp pressed). Today they sit
   between the two.
4. **Type scale is custom**: every heading is weight 800 with negative tracking, sizes don't map
   to the 30 M3 styles. M3E: baseline + emphasized styles, editorial treatment reserved for 1–2
   hero moments (e.g. the "Stash" title), not every header.
5. **Page headers**: big display titles on every tab with floating action buttons beside them.
   M3E: **large flexible app bar** (display small headline + subtitle) that collapses into a
   small app bar on scroll, ≤ 2 trailing icon buttons, one may be tonal/wide.
6. **Shape variety is low**: nearly everything uses the same 24–28dp rounding. Tactic 1 wants
   tension: square vs round, library shapes on visual elements — feed source avatars,
   collection icons, thumbnails, empty states.
7. **Color hierarchy is flat**: mostly `surfaceContainer*` with one primary accent. Use
   secondary/tertiary roles to rank (e.g. tertiary for counts/badges, secondary for selected
   filters, vibrant toolbar for edit modes).
8. **Item/reader pages**: actions should live in a **floating toolbar** (+ FAB for the primary
   action like Read/Open), not scattered buttons. Long-press menus → **vertical menus** with gaps.
9. **Capture FAB**: a **FAB menu** (Link · Note · File · Image) fits M3E exactly (2–6 related
   items, FAB morphs into close button) — valid only while the FAB isn't paired with a toolbar.
10. **Progress**: "Continue reading" bars and PDF progress could use the **wavy** linear indicator
    with stop indicator.

---

## Appendix A — exact tokens from AndroidX

**Source:** `androidx/androidx` branch `androidx-main`, commit `8bb05338948563b06d8a13e186f2bcaf8064855f` (fetched 2026-11-14).
Base path: `compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/`.
Token files live in `tokens/` (120 files). Component defaults are in the component files (`Button.kt`, `ButtonGroup.kt`, …).
The numbers below were read from those files. Values marked **UNVERIFIED** were not found in Compose source.

Notes on reading this:
- Every size is in **dp**, and every font size, line height and tracking value is in **sp**.
- A shape token name (for example `CornerMedium`) resolves through section 1.
- A color role name (for example `SecondaryContainer`) is a `ColorScheme` role.
- Disabled, hover, focus and dragged token variants are left out unless they matter. Disabled is almost always `OnSurface` at 0.38 for content and `OnSurface` at 0.12 for the container.
- Motion springs are left out (already documented). Where a component picks a motion-scheme slot, that slot is noted because it is a spec decision.

---

### 1. Shape scale (`tokens/ShapeTokens.kt`, `Shapes.kt` → `ShapeDefaults`)

| Token / ShapeDefaults | Radius (dp) | Notes |
|---|---|---|
| CornerNone | 0 | `RectangleShape` |
| CornerExtraSmall / `ShapeDefaults.ExtraSmall` | 4 | |
| CornerExtraSmallTop | 4 top, 0 bottom | text field (filled) |
| CornerSmall / `Small` | 8 | |
| CornerMedium / `Medium` | 12 | |
| CornerLarge / `Large` | 16 | |
| CornerLargeTop | 16 top, 0 bottom | |
| CornerLargeStart | 16 start (topStart and bottomStart) | |
| CornerLargeEnd | 16 end (topEnd and bottomEnd) | nav drawer |
| **CornerLargeIncreased** / `LargeIncreased` | **20** | expressive |
| CornerExtraLarge / `ExtraLarge` | 28 | |
| CornerExtraLargeTop | 28 top, 0 bottom | bottom sheet |
| **CornerExtraLargeIncreased** / `ExtraLargeIncreased` | **32** | expressive |
| **CornerExtraExtraLarge** / `ExtraExtraLarge` | **48** | expressive |
| CornerFull | `CircleShape` (50%); `ShapeDefaults.CornerFull = CornerSize(100)` percent | |

`MaterialTheme.shapes` (`Shapes` class) defaults: extraSmall 4, small 8, medium 12, large 16, extraLarge 28, largeIncreased 20, extraLargeIncreased 32, extraExtraLarge 48.

---

### 2. Typography (`tokens/TypeScaleTokens.kt`, `tokens/TypographyTokens.kt`, `tokens/TypefaceTokens.kt`)

`TypefaceTokens`: `Brand` = `Plain` = `FontFamily.SansSerif`. Weights: Regular = `FontWeight.Normal` (400), Medium = 500, Bold = 700.
Every style uses `lineHeightStyle = LineHeightStyle(alignment = Center, trim = None)`.

#### Baseline (15)
| Style | Font | Size | Line height | Tracking | Weight |
|---|---|---|---|---|---|
| displayLarge | Brand | 57 | 64 | **-0.2** | 400 |
| displayMedium | Brand | 45 | 52 | 0 | 400 |
| displaySmall | Brand | 36 | 44 | 0 | 400 |
| headlineLarge | Brand | 32 | 40 | 0 | 400 |
| headlineMedium | Brand | 28 | 36 | 0 | 400 |
| headlineSmall | Brand | 24 | 32 | 0 | 400 |
| titleLarge | Brand | 22 | 28 | 0 | 400 |
| titleMedium | Plain | 16 | 24 | **0.2** | 500 |
| titleSmall | Plain | 14 | 20 | 0.1 | 500 |
| bodyLarge | Plain | 16 | 24 | 0.5 | 400 |
| bodyMedium | Plain | 14 | 20 | **0.2** | 400 |
| bodySmall | Plain | 12 | 16 | 0.4 | 400 |
| labelLarge | Plain | 14 | 20 | 0.1 | 500 |
| labelMedium | Plain | 12 | 16 | 0.5 | 500 |
| labelSmall | Plain | 11 | 16 | 0.5 | 500 |

(Compose source uses -0.2, 0.2 and 0.2 where the older M3 web spec lists -0.25, 0.15 and 0.25. These are the values in source.)

#### Emphasized (15). The source carries a comment: "TODO update with the generated tokens once available"
| Style | Font | Size | Line height | Tracking | Weight |
|---|---|---|---|---|---|
| displayLargeEmphasized | Brand | 57 | 64 | 0 | 500 |
| displayMediumEmphasized | Brand | 45 | 52 | 0 | 500 |
| displaySmallEmphasized | Brand | 36 | 44 | 0 | 500 |
| headlineLargeEmphasized | Brand | 32 | 40 | 0 | 500 |
| headlineMediumEmphasized | Brand | 28 | 36 | 0 | 500 |
| headlineSmallEmphasized | Brand | 24 | 32 | 0 | 500 |
| titleLargeEmphasized | Brand | 22 | 28 | 0 | 500 |
| titleMediumEmphasized | Plain | 16 | 24 | 0.15 | **700** |
| titleSmallEmphasized | Plain | 14 | 20 | 0.1 | **700** |
| bodyLargeEmphasized | Plain | 16 | 24 | 0.15 | 500 |
| bodyMediumEmphasized | Plain | 14 | 20 | 0.25 | 500 |
| bodySmallEmphasized | Plain | 12 | 16 | 0.4 | 500 |
| labelLargeEmphasized | Plain | 14 | 20 | 0.1 | **700** |
| labelMediumEmphasized | Plain | 12 | 16 | 0.5 | **700** |
| labelSmallEmphasized | Plain | 11 | 16 | 0.5 | **700** |

---

### 3. Buttons (expressive)

#### 3a. Size tokens (`tokens/ButtonXSmallTokens.kt` … `ButtonXLargeTokens.kt`)
| Size | Height | Icon | Leading/trailing pad | Icon–label gap | Round shape | Square shape | **Pressed shape** | Selected (round) | Selected (square) | Outline width |
|---|---|---|---|---|---|---|---|---|---|---|
| XSmall | 32 | 20 | 16 / 16 | 8 (but `ButtonDefaults.ExtraSmallIconSpacing = 4`) | Full | Medium 12 | Small 8 | Full | Medium 12 | 1 |
| Small (default) | 40 | 20 | 16 / 16 | 8 | Full | Medium 12 | Small 8 | Full | Medium 12 | 1 |
| Medium | 56 | 24 | 24 / 24 | 8 | Full | Large 16 | Medium 12 | Full | Large 16 | 1 |
| Large | 96 | 32 | 48 / 48 | 12 | Full | ExtraLarge 28 | Large 16 | Full | ExtraLarge 28 | 2 |
| XLarge | 136 | 40 | 64 / 64 | 16 | Full | ExtraLarge 28 | Large 16 | Full | ExtraLarge 28 | 3 |

Baseline (non-expressive) `BaselineButtonTokens`: height 40, icon 20, leading/trailing 24, gap 8, round = Full, square = Medium, pressed = Small.

#### 3b. `ButtonDefaults` (`Button.kt`)
| Value | Source value |
|---|---|
| `ContentPadding` | start 24, end 24, top/bottom 8 |
| `ButtonWithIconContentPadding` | start 16, end 24, v 8 |
| `SmallContentPadding` | h 16 (with icon: 16, or 12 under precision-pointer sizing), v **10** (8 under precision pointer) |
| `ExtraSmallContentPadding` | h 12, v 6 |
| `MediumContentPadding` | h 24, v 16 |
| `LargeContentPadding` | h 48, v 32 |
| `ExtraLargeContentPadding` | h 64, v 48 |
| `TextButtonContentPadding` | h 12, v 8. With icon: start 12, end 16 |
| `MinWidth` / `MinHeight` | 58 / 40 |
| `IconSize` (legacy) | 18 |
| `IconSpacing` | 8. XS 4, M 8, L 12, XL 16 |
| `textStyleFor(height)` | < 56 → labelLarge; < 96 → titleMedium; < 136 → headlineSmall; ≥ 136 → headlineLarge |
| `shape`, `elevatedShape`, `filledTonalShape`, `outlinedShape`, `textShape` | Small round = **Full** |
| `squareShape` | Small square = Medium 12 |
| `pressedShape` | Small 8. `extraSmallPressedShape` 8, `mediumPressedShape` 12, `largePressedShape` 16, `extraLargePressedShape` 16 |
| `shapes()` default | `ButtonShapes(shape = Full, pressedShape = CornerSmall 8)` |
| Outline | `BorderStroke(1, OutlineVariant)` |
| Shape-morph spring | `MotionSchemeKeyTokens.DefaultEffects`. Source comment says it is "intentional here to prevent any bounce" (same in IconButton). ToggleButton uses **FastSpatial**. |

#### 3c. Button color roles (default, non-toggle)
| Variant | Container | Content | Elevation (rest / pressed) |
|---|---|---|---|
| Filled (`FilledButtonTokens`) | Primary | OnPrimary | 0 / 0 |
| Tonal (`FilledTonalButtonTokens`) | SecondaryContainer | OnSecondaryContainer | 0 / 0 |
| Elevated (`ElevatedButtonTokens`) | SurfaceContainerLow | Primary | Level1 (1) / Level1 |
| Outlined (`OutlinedButtonTokens`) | Transparent | OnSurfaceVariant; outline OutlineVariant | 0 |
| Text | Transparent | **Primary** (hard-coded `ColorSchemeKeyTokens.Primary` in `defaultTextButtonColors`; `TextButtonTokens.LabelColor` says OnSurfaceVariant but is not used) | 0 |

#### 3d. Toggle buttons (`ToggleButton.kt` → `ToggleButtonDefaults`)
Shapes: `shape` = Small round (Full), `pressedShape` = Small 8, `checkedShape` = Small **SelectedContainerShapeSquare = Medium 12**. Per-size checked shapes are the size's square shape: XS 12, M 16, L 28, XL 28. So a round toggle morphs to a rounded square when checked.

| Variant | Unchecked container / content | Checked container / content |
|---|---|---|
| Filled (`ToggleButton`) | SurfaceContainer / OnSurfaceVariant | Primary / OnPrimary |
| Tonal (`TonalToggleButton`, `TonalButtonTokens`) | SecondaryContainer / OnSecondaryContainer | **Secondary / OnSecondary** |
| Elevated | SurfaceContainerLow / Primary | Primary / OnPrimary |
| Outlined | Transparent (outline OutlineVariant) / OnSurfaceVariant | **InverseSurface / InverseOnSurface** |

---

### 4. Icon buttons (`tokens/*IconButtonTokens.kt`, `IconButtonDefaults.kt`)

Container width = icon + leading + trailing space (`*ContainerSize(widthOption)`). The default `widthOption` is `Uniform`.

| Size | Height | Icon | Narrow pad | Uniform pad | Wide pad | **Narrow W** | **Uniform W** | **Wide W** | Round | Square | Pressed | Selected round → | Selected square → | Outline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| XSmall | 32 | 20 | 4+4 | 6+6 | 10+10 | 28 | 32 | 40 | Full | Medium 12 | Small 8 | Medium 12 | Full | 1 |
| Small (default) | 40 | 24 | 4+4 | 8+8 | 14+14 | 32 | 40 | 52 | Full | Medium 12 | Small 8 | Medium 12 | Full | 1 |
| Medium | 56 | 24 | 12+12 | 16+16 | 24+24 | 48 | 56 | 72 | Full | Large 16 | Medium 12 | Large 16 | Full | 1 |
| Large | 96 | 32 | 16+16 | 32+32 | 48+48 | 64 | 96 | 128 | Full | ExtraLarge 28 | Large 16 | ExtraLarge 28 | Full | 2 |
| XLarge | 136 | 40 | 32+32 | 48+48 | 72+72 | 104 | 136 | 184 | Full | ExtraLarge 28 | Large 16 | ExtraLarge 28 | Full | 3 |

Selected shapes are swapped: a **round** icon button becomes a rounded square when selected, and a **square** one becomes round.
`IconButtonDefaults.standardShape` / `filledShape` / `outlinedShape` = Small round (Full). `shapes()` default = round + pressed Small (8). `toggleableShapes()` default = round, pressed 8, checked = SmallSelectedRound (Medium 12).

| Variant | Default container / content | Toggle unchecked | Toggle checked |
|---|---|---|---|
| Standard (`IconButtonTokens`) | transparent / OnSurfaceVariant | transparent / OnSurfaceVariant | transparent / **Primary** |
| Filled | Primary / OnPrimary | SurfaceContainer / OnSurfaceVariant | Primary / OnPrimary |
| Tonal | SecondaryContainer / OnSecondaryContainer | SecondaryContainer / OnSecondaryContainer | Secondary / OnSecondary |
| Outlined | transparent, outline OutlineVariant / OnSurfaceVariant | same | InverseSurface / InverseOnSurface |

---

### 5. Button groups (`ButtonGroup.kt`, `tokens/ButtonGroupSmallTokens.kt`, `tokens/ConnectedButtonGroupSmallTokens.kt`)

| Value | Standard | Connected |
|---|---|---|
| Container height (Small) | 40 | 40 |
| Gap between buttons | **12** (`HorizontalArrangement = spacedBy(12)`) | **2** (`ConnectedSpaceBetween`) |
| Outer corners | (each button's own shape) | Full |
| Inner corner (rest) | n/a | **8** (`CornerValueSmall`) |
| Inner corner (pressed) | n/a | **4** (`CornerValueExtraSmall`) |
| Checked shape | n/a | **Full** (`connectedButtonCheckedShape = CircleShape`); token `SelectedInnerCornerCornerSizePercent = 50` |
| Middle button rest shape | n/a | `ShapeDefaults.Small` (8 on all corners) |
| Middle button pressed shape | n/a | 4 on all corners |

The only size tokens are for Small. Other sizes are **UNVERIFIED**.

**Press-to-expand behaviour (standard group, `animateWidth`):**
- `ButtonGroupDefaults.ExpandedRatio = 0.15f`.
- A pressed child animates `pressedAnimatable` 0→1 with the **FastSpatial** spring. On release it waits until the value is > 0.75, then animates back to 0.
- Growth for the **first** item is `progress × min(0.15 × width, next.compressionLimit)` and comes only from the next item. The **last** item does the same with the previous item.
- Growth for a **middle** item is `progress × min(0.15 × width / 2, prev.limit, next.limit)`, taken from each neighbour, so up to 2× that in total.
- Neighbours shrink by the same number of pixels. `compressionLimit` defaults to 0 dp in the parent data; buttons pass their content padding when using `animateWidth`.
- The overflow indicator is a `FilledIconButton` (shape `filledShape`) with a MoreVert icon.

---

### 6. Split button (`SplitButton.kt` → `SplitButtonDefaults`, `tokens/SplitButton*Tokens.kt`)

| Size | Height | Gap | Inner corner (rest) | Inner corner (pressed) | Leading btn pad (start/end) | Trailing btn pad (start/end) | Trailing icon |
|---|---|---|---|---|---|---|---|
| XSmall | 32 | 2 | 4 | 8 | 12 / 10 | 13 / 13 | 22 |
| Small (default) | 40 | 2 | 4 | 12 | 16 / 12 | 13 / 13 | 22 |
| Medium | 56 | 2 | 4 | 12 | 24 / 24 | 15 / 15 | 26 |
| Large | 96 | 2 | 8 | 20 | 48 / 48 | 29 / 29 | 38 |
| XLarge | 136 | 2 | 12 | 20 | 64 / 64 | 43 / 43 | 50 |

- Outer corners are `ShapeDefaults.CornerFull` (100%). The XSmall token `OuterCornerCornerSizePercent = 50`.
- Trailing button **checked shape is `CircleShape`** (`TrailingInnerSelectedCornerCornerSizePercent = 50`). The leading button has no checked shape.
- `LeadingIconSize` = 20 (Small). Leading and trailing min width are both 48.
- Trailing state layer alpha = `PressedStateLayerOpacity` 0.1.
- The shape-morph spring is **DefaultEffects**.
- The trailing chevron rotation is **not** in the component. It comes from samples (UNVERIFIED as a default).

---

### 7. FAB, extended FAB, FAB menu

#### FAB (`tokens/Fab*Tokens.kt`, `FloatingActionButton.kt`)
| FAB | Size | Shape | Icon |
|---|---|---|---|
| Small (deprecated in expressive) | 40×40 | Medium 12 | 24 |
| Baseline (`FloatingActionButton`) | 56×56 | Large 16 | 24 |
| **Medium** (`MediumFloatingActionButton`) | **80×80** | **LargeIncreased 20** (`ShapeDefaults.LargeIncreased`, TODO in source) | **28** |
| Large | 96×96 | ExtraLarge 28 | **36** (`LargeIconSize = 36.dp`, "TODO: FabLargeTokens.IconSize is incorrect"; the token says 32) |

- Colors: PrimaryContainer / OnPrimaryContainer. Secondary variant: SecondaryContainer / OnSecondaryContainer.
- Elevation: Level3 (6) at rest and pressed, Level4 when hovered (from the baseline tokens). `loweredElevation` is Level1.
- Show/hide target scale is `0.2f`.

#### Extended FAB
| Size | Height (min W = H) | Shape | Leading/trailing | Icon–label gap (used) | Icon | Label style |
|---|---|---|---|---|---|---|
| Small | 56 | Large 16 | 16 / 16 | 8 | 24 | **titleMedium** |
| Medium | 80 | LargeIncreased 20 | 26 / 26 | **12** (token says 16, "incorrect") | 28 | **titleLarge** |
| Large | 96 | ExtraLarge 28 | 28 / 28 | **16** (token says 20, "incorrect") | 36 | **headlineSmall** |
| Legacy `ExtendedFloatingActionButton` | 56, min width 80 | Large 16 | icon start 16, end 12; text 20 | n/a | 24 | labelLarge |

#### FAB menu (`FloatingActionButtonMenu.kt`, `tokens/FabMenuBaselineTokens.kt`)
| Value | Source value |
|---|---|
| Menu item height / min width | 56 / 56 |
| Item shape | Full |
| Item leading / trailing padding | 24 / 24 |
| Item icon / icon–label gap | 24 / 8 |
| Gap between items | 4 |
| Item label style | `titleMedium` |
| Item colors (default) | PrimaryContainer / OnPrimaryContainer (`contentColorFor`) |
| Item elevation (token) | Level3 |
| Menu horizontal padding | 16 |
| Gap from last item to close button | 8 (`CloseButtonBetweenSpace`) |
| Bottom padding under the button | 16 |
| Close (checked) button | 56×56, Full (corner 28), icon 20 |
| Item stagger | an Int animatable driven by **SlowEffects**. Item width uses FastSpatial, alpha uses FastEffects |

`ToggleFloatingActionButton` interpolates by `checkedProgress` (FastSpatial):
| | Unchecked → checked |
|---|---|
| Container color | primaryContainer → **primary** |
| Icon color | onPrimaryContainer → **onPrimary** |
| Size (default / medium / large) | 56 / 80 / 96 → 56 |
| Corner radius (default / medium / large) | 16 / 20 / 28 → 28 (= 56/2) |
| Icon size (default / medium / large) | 24 / 28 / 36 → 20 |

---

### 8. Floating toolbar (`FloatingToolbar.kt` → `FloatingToolbarDefaults`, `tokens/FloatingToolbarTokens.kt`)
| Value | Source value |
|---|---|
| Container size (height of a horizontal toolbar) | **64** |
| Shape | Full |
| Content padding | **8** on all sides (leading/trailing space 8, also used for top/bottom) |
| Gap between items (token) | 4 |
| Screen offset (external padding) | 16 |
| Elevation | expanded 0, collapsed 0. With a FAB: expanded **Level1**, collapsed 0 |
| FAB elevation (toolbar FABs) | Level2 at rest, pressed and focused; Level3 hovered |
| Toolbar-to-FAB gap | 8 |
| FAB size range | 56–80 |
| Scroll threshold | 40 |
| Standard colors | container **SurfaceContainer**, content OnSurface. FAB: **PrimaryContainer / OnPrimaryContainer** |
| Vibrant colors | container **PrimaryContainer**, content OnPrimaryContainer. FAB: **TertiaryContainer / OnTertiaryContainer** |
| Vibrant selected button (token) | container SurfaceContainer, icon/text OnSurface. Unselected icon/text OnPrimaryContainer |
| Expand/collapse | FastSpatial |

`StandardFloatingActionButton` / `VibrantFloatingActionButton` use `FloatingActionButtonDefaults.shape` (Large 16, 56dp).

Docked toolbar (`DockedToolbarTokens`): height 64, SurfaceContainer, shape None, leading/trailing 16, item spacing 4 min / 32 max.

---

### 9. Loading and progress indicators

#### LoadingIndicator / ContainedLoadingIndicator (`LoadingIndicator.kt`, `tokens/LoadingIndicatorTokens.kt`)
| Value | Source value |
|---|---|
| Container | 48×48, shape Full |
| Active indicator size | **38** (`ActiveIndicatorScale = 38/48`) |
| Uncontained color | Primary |
| Contained | container **PrimaryContainer**, indicator **OnPrimaryContainer** |
| Indeterminate polygon sequence | **SoftBurst → Cookie9Sided → Pentagon → Pill → Sunny → Cookie4Sided → Oval** (loops) |
| Determinate sequence | Circle rotated by 360/20 = 18° → SoftBurst (morphs with progress) |
| Morph spring | `spring(dampingRatio = 0.6f, stiffness = 200f, visibilityThreshold = 0.1f)` |
| Morph interval | **650 ms** per shape |
| Per-morph extra rotation | +90° (QuarterRotation) each step |
| Global rotation | 360° linear every **4666 ms**, infinite |

Polygons are scaled to fit inside the container while they rotate (`calculateScaleFactor × ActiveIndicatorScale`).

#### Wavy progress (`WavyProgressIndicator.kt` → `WavyProgressIndicatorDefaults`)
| Value | Linear | Circular |
|---|---|---|
| Stroke (active and track) | 4, round cap | 4, round cap |
| Wave amplitude (token) | **3** | **1.6** |
| Wavelength | determinate **40**, indeterminate **20** | **15** |
| Container | height **10** (`WaveHeight`), default width 240 | **48** (`WaveSize`); the flat circular is 40 |
| Indicator–track gap | 4 | 4 |
| Stop indicator | 4 (`StopSize`), trailing space 0 | n/a |
| Wave speed | = wavelength per second (`waveSpeed = wavelength`) | same |
| Amplitude function | `0` if progress ≤ 0.1 or ≥ 0.95, else `1` | same |
| Progress anim | tween 500 ms linear (DurationLong2) | same |
| Amplitude in / out | tween 500 standard / 500 emphasized-accelerate | same |
| Colors | indicator Primary, track **SecondaryContainer** | same |

Flat (`ProgressIndicator.kt`):
- Linear: height 4, track gap 4, stop indicator 4.
- Circular: 40, stroke 4, gap 4.
- Linear indeterminate cycle: 1750 ms. Line 1 head 0–1000 and tail 250–1250; line 2 head 650–1500 and tail 900–1750.
- Circular indeterminate: progress cycle 6000 ms, sweep 0.1–0.87, global rotation 1080°, extra rotation 360° (delay 1500, 300 ms).

---

### 10. Navigation bar and rail (expressive)

#### ShortNavigationBar (`ShortNavigationBar.kt`, `tokens/NavigationBar*Tokens.kt`)
| Value | Source value |
|---|---|
| Min height | **64** (`NavigationBarTokens.ContainerHeight`). The tall/classic height is 80 |
| Container | SurfaceContainer, Level2 token |
| Arrangement | `EqualWeight` (default) or `Centered` |
| Top-icon item | indicator **56×32**, Full; icon 24; indicator→label 4; item vertical padding 6 |
| Start-icon item (horizontal) | indicator height **40**, padding 16 start and end, icon→label 4 |
| Label | `labelMedium` |
| Selected | indicator **SecondaryContainer**, icon **OnSecondaryContainer**, label **Secondary** (top icon) or OnSecondaryContainer (start icon) |
| Unselected | icon / label OnSurfaceVariant |

#### WideNavigationRail (`WideNavigationRail.kt`, `tokens/NavigationRail*Tokens.kt`)
| Value | Source value |
|---|---|
| Collapsed width | **96** (narrow variant token: 80) |
| Expanded width | min **220**, max **360** |
| Top padding | 44 |
| Header bottom space | 40 |
| Collapsed item vertical spacing | 4 |
| Collapsed item (top icon) | min height 64, indicator **56×32**, icon 24, icon→label 4, label `labelMedium` |
| Expanded item (start icon) | indicator height **56**, full-width padding 16/16, icon→label 8, label `labelLarge` |
| Item horizontal padding (no-label case) | 20 |
| Indicator shape | Full |
| Container | Surface (standard), shape None, elevation 0 |
| Modal expanded | **SurfaceContainer**, shape **Large 16**, Level2. Scrim = Scrim @ 0.32 |
| Colors | active icon OnSecondaryContainer, indicator SecondaryContainer, label Secondary. Inactive OnSurfaceVariant |
| Expand animation | DefaultSpatial (modal: FastSpatial) |

---

### 11. Top app bars (`AppBar.kt`, `tokens/AppBar*Tokens.kt`)
| Bar | Expanded height | Collapsed | Title style | Subtitle style | Title bottom pad |
|---|---|---|---|---|---|
| Small / CenterAligned | 64 | n/a | titleLarge | labelMedium | n/a |
| Medium (legacy) | 112 | 64 | headlineSmall | n/a | 24 |
| **MediumFlexible** | **112** (no subtitle) / **136** (with subtitle) | 64 | **headlineMedium** | **labelLarge** | 24 |
| Large (legacy) | 152 | 64 | headlineMedium | n/a | 28 |
| **LargeFlexible** | **120** (no subtitle) / **152** (with subtitle) | 64 | **displaySmall** | **titleMedium** | 28 |

Common values (`AppBarTokens`):
- Horizontal padding 4, title inset 16-4 = 12, icon 24, avatar 32.
- Container Surface, and **SurfaceContainer** on scroll (Level2 token, but `ContainerElevation = 0`).
- Nav icon OnSurface, action icons **OnSurfaceVariant**, title OnSurface, subtitle OnSurfaceVariant.
- Top-title alpha easing: `CubicBezier(.8, 0, .8, .15)`.

Bottom app bar: 80 high, SurfaceContainer, Level2.

---

### 12. Other components

#### Cards (`tokens/*CardTokens.kt`)
| Card | Container | Shape | Elevation | Outline |
|---|---|---|---|---|
| Filled | SurfaceContainerHighest | Medium 12 | 0 | n/a |
| Elevated | SurfaceContainerLow | Medium 12 | Level1 | n/a |
| Outlined | Surface | Medium 12 | 0 | 1, OutlineVariant |

No content padding is defined.

#### Chips (`Chip.kt`, `tokens/*ChipTokens.kt`, `tokens/ChipsTokens.kt`)
| Value | Source value |
|---|---|
| Height | 32 |
| Default shape (assist/filter/input/suggestion) | **Small 8** |
| Expressive `FilterChipDefaults.shapes()` / `InputChipDefaults.shapes()` | rest **Medium 12**, selected **Full**, pressed **Small 8** (`ChipsTokens`) |
| Icon (leading/trailing) | 18. Avatar 24 (Full) |
| Label | labelLarge |
| Content padding | horizontal 8. Gap between elements 8 (compact 4) |
| Input-chip padding | start 4 if avatar or no leading icon, else 8; end 8 if trailing icon, else 4 |
| Outline (flat, unselected) | 1, OutlineVariant. 0 when selected |
| Filter selected | container SecondaryContainer, label/icons OnSecondaryContainer |
| Filter unselected | label OnSurfaceVariant, leading icon **Primary**, trailing OnSurfaceVariant |
| Assist | label OnSurface, icon Primary |
| Suggestion | label OnSurfaceVariant, icon Primary |
| Input selected | SecondaryContainer / OnSecondaryContainer, leading icon Primary |
| Elevated variants | container SurfaceContainerLow, Level1 |
| Chip shape morph | FastSpatial |

#### Lists (`ListItem.kt`, `ListItemDefaults.kt`, `tokens/ListTokens.kt`)
| Value | Source value |
|---|---|
| Heights | 1-line 56, 2-line 72, 3-line 88 |
| Padding | start 16, end 16, top 10, bottom 10 (12/12 under precision pointer) |
| Internal gap (leading↔content↔trailing) | 12 |
| Leading icon | expressive **20** (legacy 24). Trailing icon expressive 20 |
| Avatar | 40, Full, PrimaryContainer / OnPrimaryContainer |
| Leading image | 56×56, expressive shape Small 8 |
| Video | small 100×56, large 114×64, shape Small 8 |
| **Expressive item shapes** (`ListItemDefaults.shapes()`) | rest **ExtraSmall 4**, pressed **Large 16**, selected **Large 16**, focused Large 16, hovered **Medium 12**, dragged Large 16 |
| **Segmented** (`segmentedShapes(index, count)`) | outer corners overridden by `ListTokens.ContainerShape` = **Large 16**. First item: top corners 16, bottom 4. Middle: 4 all round. Last: top 4, bottom 16. Single item: 16 all round |
| Segmented gap | **2** (`ListItemDefaults.SegmentedGap`) |
| Segmented container | Surface (`ItemSegmentedContainerColor`) |
| Selected | SecondaryContainer. Label, supporting and icons OnSecondaryContainer |
| Text | label bodyLarge OnSurface, supporting bodyMedium OnSurfaceVariant, overline labelSmall, trailing supporting labelSmall |
| Dragged elevation | Level4 |
| Reorder item | TertiaryContainer / OnTertiaryContainer, Large 16 |
| Animations | shape FastSpatial, color DefaultEffects, elevation FastSpatial |

#### Search bar / AppBarWithSearch (`SearchBar.kt`, `tokens/SearchBarTokens.kt`, `SearchViewTokens.kt`)
| Value | Source value |
|---|---|
| Input field height | 56 |
| Input shape | Full |
| Container | SurfaceContainerHigh. Elevation in defaults is 0 (token Level3) |
| Input text / placeholder | bodyLarge OnSurface / OnSurfaceVariant. Leading icon OnSurface, trailing OnSurfaceVariant |
| Avatar | 30 |
| Docked expanded shape | ExtraLarge 28. Header 56. Dropdown gap 2. Table min height 240 |
| Full-screen | shape None, header 72 |
| Width | min 360, max 720. Vertical padding 8. Icon offset 4 (16 from edges) |
| AppBarWithSearch | horizontal and vertical padding 4. Search bar as top bar padding 8. App bar Surface → SurfaceContainer on scroll. Scrolled search field **SurfaceContainerHighest** |
| Animation | enter 600 ms emphasized-decelerate, exit 350 ms `CubicBezier(0,1,0,1)` |

#### Carousel (`carousel/Carousel.kt` → `CarouselDefaults`)
| Value | Source value |
|---|---|
| Min / max small item size | **40 / 56** |
| Item spacing | **0** by default (samples pass 8; UNVERIFIED as a spec default) |
| Anchor size | 10 |
| Medium/large diff threshold | 0.85 |
| Item corner | **not set by the component.** Samples use `MaterialTheme.shapes.extraLarge` (28) via `maskClip` (UNVERIFIED as a default) |
| Snap spring | `Spring.StiffnessMediumLow` |

#### Slider (`Slider.kt`, `tokens/SliderTokens.kt`)
| Value | Source value |
|---|---|
| Track height (active/inactive) | **16** |
| Handle | **4 × 44**, Full. Pressed width **2** |
| Handle–track gap | 6 |
| Track inside corner (next to the handle) | **2**. Outer corners Full |
| Stop/tick indicator | 4, Full, trailing space 6 |
| Colors | active track/handle Primary, inactive track **SecondaryContainer**, stop SecondaryContainer |
| Value indicator | InverseSurface / InverseOnSurface, labelLarge, 12 above |
| **Expressive XS/S/M/L/XL slider sizes** (track 16/24/40/56/96 etc.) | **UNVERIFIED**. No such tokens or defaults exist in Compose source |

#### Switch (`tokens/SwitchTokens.kt`)
| Value | Source value |
|---|---|
| Track | 52×32, Full, outline 2 (unselected) |
| Handle | unselected **16**, selected **24**, with icon 24, pressed **28** |
| Icon | 16 |
| State layer | 40 |
| Selected | track Primary, handle OnPrimary, icon OnPrimaryContainer. Pressed handle PrimaryContainer |
| Unselected | track SurfaceContainerHighest, outline Outline, handle Outline, icon SurfaceContainerHighest. Pressed handle OnSurfaceVariant |
| Thumb anim | FastSpatial |

#### Checkbox (`tokens/CheckboxTokens.kt`)
- Box 18, corner **2**, unselected outline 2 (OnSurfaceVariant), selected outline 0.
- Selected: container Primary, check OnPrimary. Error: Error / OnError.
- State layer 40 (Full).
- Animation: DefaultSpatial for the check, Fast/DefaultEffects for color.

#### Snackbar (`Snackbar.kt`, `tokens/SnackbarTokens.kt`)
| Value | Source value |
|---|---|
| Height | 1 line 48, 2 lines 68 |
| Shape | ExtraSmall 4 |
| Colors | InverseSurface / InverseOnSurface. Action **InversePrimary**. Icon InverseOnSurface |
| Text / action | bodyMedium / labelLarge |
| Elevation | Level3 |
| Max width | 600 |
| Padding | horizontal 16 (button side 8). Vertical 14 (legacy 6). Height to first line 30. Long-button offset 12. Action bottom padding 4 |

#### Dialog (`AlertDialog.kt`, `tokens/DialogTokens.kt`)
- Container SurfaceContainerHigh, shape **ExtraLarge 28**, Level3 token (`TonalElevation = 0`).
- Width min 280, max 560. Padding **24** (20 under precision pointer).
- Icon 24 (Secondary), padding 16 below. Title headlineSmall OnSurface, padding 16 below. Body bodyMedium OnSurfaceVariant, padding 24 below.
- Buttons: labelLarge Primary, spacing 8 (main axis) and 8 (cross axis).

#### Bottom sheet (`SheetDefaults.kt`, `tokens/SheetBottomTokens.kt`)
- Container SurfaceContainerLow, shape **ExtraLargeTop (28 top)**, Level1. Minimized shape None.
- Drag handle **32×4**, OnSurfaceVariant, vertical padding **22** (48 touch row).
- Peek 56, max width 640. Positional threshold 56, velocity threshold 125.
- Animation: tween 300 FastOutSlowIn.
- Pane drag handle (`DragHandleTokens`, for adaptive panes): 4×48, Outline, Full. Pressed and dragged 12×52, Medium 12, OnSurface.

#### Menus (`Menu.kt`, `MenuDefaults.kt`, `tokens/MenuTokens.kt`, `SegmentedMenuTokens.kt`, `StandardMenuTokens.kt`, `VibrantMenuTokens.kt`)
| Value | Source value |
|---|---|
| Legacy menu | SurfaceContainer, **ExtraSmall 4**, shadow Level2 |
| Item height | legacy 48. Expressive (`SegmentedMenuTokens.Item`) **44** |
| Item width | min 112, max 280 |
| Menu vertical padding | 8. Horizontal margin 8, vertical margin 48 |
| Item padding | horizontal 12 (legacy). Segmented token leading/trailing 16, top/bottom 8 |
| Icon | 20 (leading and trailing). Icon–text gap 8 (12 under precision pointer) |
| Item text | bodyLarge. Supporting bodyMedium. Trailing supporting labelSmall |
| **Group shapes** | standalone group **Large 16**. Leading group top 16 / bottom 8. Middle group **Small 8**. Trailing group top 8 / bottom 16. Inactive group Small 8 |
| Gap between groups | **2** (`GroupSpacing`). Group padding (token) 4 |
| **Item shapes** | middle/standalone **ExtraSmall 4**. Leading item top 12 / bottom 4. Trailing item top 4 / bottom 12. **Selected item Medium 12** |
| Group label padding | start 12, end 4. Group min height 32, vertical padding 2 |
| Divider padding | horizontal 12, vertical 2 |
| Standard (expressive) colors | container **SurfaceContainerLow**. Selected item **TertiaryContainer / OnTertiaryContainer**. Label OnSurface, icons OnSurfaceVariant |
| Vibrant colors | container **TertiaryContainer**, content OnTertiaryContainer. Selected item **Tertiary / OnTertiary** |
| Legacy selected | SecondaryContainer / OnSecondaryContainer |
| Horizontal segmented item | pressed Medium 12, selected-pressed Full, icon-only selected Full |

#### Tooltip (`Tooltip.kt`, `tokens/PlainTooltipTokens.kt`, `RichTooltipTokens.kt`)
| Value | Plain | Rich |
|---|---|---|
| Container | InverseSurface | SurfaceContainer, Level2 |
| Shape | ExtraSmall 4 | Medium 12 |
| Text | bodySmall InverseOnSurface | subhead titleSmall, body bodyMedium (OnSurfaceVariant). Action labelLarge Primary |
| Max width | 200 | 320 |
| Padding | 8 h / 4 v | 16 h. 28 to subhead first line, 24 subhead→text, 16 text bottom. Action min height 36, bottom 8 |

Common to both:
- Min size 40×24.
- Anchor spacing 4.
- Caret 16×8.

---

### 13. MaterialShapes (`MaterialShapes.kt`)

There are 35 public shapes. Every one is `.normalized()` into a 0..1 box, and `customPolygon` centers on (0.5, 0.5).
Circle, Square, Slanted, Arch, Fan, Arrow, SemiCircle, Oval, Pill, Triangle, Diamond, ClamShell, Pentagon, Gem, Sunny, VerySunny, Cookie4Sided, Cookie6Sided, Cookie7Sided, Cookie9Sided, Cookie12Sided, Ghostish, Clover4Leaf, Clover8Leaf, Burst, SoftBurst, Boom, SoftBoom, Flower, Puffy, PuffyDiamond, PixelCircle, PixelTriangle, Bun, Heart.

Cached roundings: `r15 = CornerRounding(0.15)`, `r20 = 0.2`, `r30 = 0.3`, `r50 = 0.5`, `r100 = 1.0`. `CornerRounding(a, b)` means `(radius = a, smoothing = b)`.

`customPolygon(points, reps, mirroring)` behaves as follows:
- **Without mirroring:** the listed points are rotated around the center `reps` times by 360/reps.
- **With mirroring:** `2×reps` sections, where each odd section reflects the points.

| Shape | Construction (verbatim parameters) |
|---|---|
| Circle | `RoundedPolygon.circle(numVertices = 10)` |
| Square | `RoundedPolygon.rectangle(width = 1f, height = 1f, rounding = r30)` |
| Slanted | custom, reps 2: `(0.926, 0.970) CR(0.189, 0.811)`, `(-0.021, 0.967) CR(0.187, 0.057)` |
| Arch | `RoundedPolygon(numVertices = 4, perVertexRounding = [r100, r100, r20, r20])`, rotated -135° |
| Oval | `RoundedPolygon.circle()` (library default vertex count, UNVERIFIED: 8), scaled `(1, 0.64)`, rotated -45° |
| Pill | custom, reps 2, mirroring: `(0.961, 0.039) CR(0.426)`, `(1.001, 0.428)` unrounded, `(1.000, 0.609) CR(1.0)` |
| Triangle | `RoundedPolygon(numVertices = 3, rounding = r20)`, rotated -90° |
| Pentagon | custom, reps 1, mirroring: `(0.500, -0.009) CR(0.172)`, `(1.030, 0.365) CR(0.164)`, `(0.828, 0.970) CR(0.169)` |
| Gem | custom, reps 1, mirroring: `(0.499, 1.023) CR(0.241, 0.778)`, `(-0.005, 0.792) CR(0.208)`, `(0.073, 0.258) CR(0.228)`, `(0.433, -0.000) CR(0.491)` |
| Sunny | `RoundedPolygon.star(numVerticesPerRadius = 8, innerRadius = .8f, rounding = r15)` |
| VerySunny | custom, reps 8: `(0.500, 1.080) CR(0.085)`, `(0.358, 0.843) CR(0.085)` |
| Cookie4Sided | custom, reps 4: `(1.237, 1.236) CR(0.258)`, `(0.500, 0.918) CR(0.233)` |
| Cookie6Sided | custom, reps 6: `(0.723, 0.884) CR(0.394)`, `(0.500, 1.099) CR(0.398)` |
| Cookie7Sided | `RoundedPolygon.star(numVerticesPerRadius = 7, innerRadius = .75f, rounding = r50)`, rotated -90° |
| **Cookie9Sided** | `RoundedPolygon.star(numVerticesPerRadius = 9, innerRadius = .8f, rounding = r50)`, rotated -90° |
| **Cookie12Sided** | `RoundedPolygon.star(numVerticesPerRadius = 12, innerRadius = .8f, rounding = r50)`, rotated -90° |
| Clover4Leaf | custom, reps 4, mirroring: `(0.500, 0.074)` unrounded, `(0.725, -0.099) CR(0.476)` |
| Clover8Leaf | custom, reps 8: `(0.500, 0.036)` unrounded, `(0.758, -0.101) CR(0.209)` |
| Burst | custom, reps 12: `(0.500, -0.006) CR(0.006)`, `(0.592, 0.158) CR(0.006)` |
| **SoftBurst** | custom, reps 10: `(0.193, 0.277) CR(0.053)`, `(0.176, 0.055) CR(0.053)` |
| Boom | custom, reps 15: `(0.457, 0.296) CR(0.007)`, `(0.500, -0.051) CR(0.007)` |
| Flower | custom, reps 8, mirroring: `(0.370, 0.187)`, `(0.416, 0.049) CR(0.381)`, `(0.479, 0.001) CR(0.095)` |
| SemiCircle | `RoundedPolygon.rectangle(width = 1.6f, height = 1f, perVertexRounding = [r20, r20, r100, r100])` |
| Diamond | custom, reps 2: `(0.500, 1.096) CR(0.151, 0.524)`, `(0.040, 0.500) CR(0.159)` |
| ClamShell | custom, reps 2: `(0.171, 0.841) CR(0.159)`, `(-0.020, 0.500) CR(0.140)`, `(0.170, 0.159) CR(0.159)` |
| Fan | custom, reps 1: `(1.004, 1.000) CR(0.148, 0.417)`, `(0.000, 1.000) CR(0.151)`, `(0.000, -0.003) CR(0.148)`, `(0.978, 0.020) CR(0.803)` |
| Arrow | custom, reps 1: `(0.500, 0.892) CR(0.313)`, `(-0.216, 1.050) CR(0.207)`, `(0.499, -0.160) CR(0.215, 1.0)`, `(1.225, 1.060) CR(0.211)` |
| Ghostish | custom, reps 1, mirroring: `(0.5, 0) CR(1)`, `(1, 0) CR(1)`, `(1, 1.140) CR(0.254, 0.106)`, `(0.575, 0.906) CR(0.253)` |
| SoftBoom | custom, reps 16, mirroring: `(0.733, 0.454)`, `(0.839, 0.437) CR(0.532)`, `(0.949, 0.449) CR(0.439, 1.0)`, `(0.998, 0.478) CR(0.174)` |
| PuffyDiamond | custom, reps 4, mirroring: `(0.870, 0.130) CR(0.146)`, `(0.818, 0.357)`, `(1.000, 0.332) CR(0.853)` |
| Bun | custom, reps 2, mirroring: `(0.796, 0.500)`, `(0.853, 0.518) CR(1)`, `(0.992, 0.631) CR(1)`, `(0.968, 1.000) CR(1)` |

Puffy, Heart, PixelCircle and PixelTriangle are also defined. They are left out here: Puffy and Heart are banned by project rules, and the pixel shapes are long unrounded step lists.

Helpers: `Morph.toPath(progress, path, startAngle)`, `RoundedPolygon.toPath(startAngle)`, `RoundedPolygon.toShape(startAngle = 0)`.

---

### 14. Elevation and state layers

`tokens/ElevationTokens.kt`:
| Level | dp |
|---|---|
| Level0 | 0 |
| Level1 | 1 |
| Level2 | 3 |
| Level3 | 6 |
| Level4 | 8 |
| Level5 | 12 |

`tokens/StateTokens.kt`:
| State | Opacity |
|---|---|
| Hover | 0.08 |
| Focus | **0.10** |
| Pressed | **0.10** |
| Dragged | 0.16 |

Scrim: `ScrimTokens` → Scrim color at **0.32**.
Disabled (repeated across tokens): content 0.38, container 0.12.

---

### UNVERIFIED / not present in Compose source
- Expressive **slider size variants** (XS–XL track heights and handle heights). Compose only has the 16 dp track and 4×44 handle.
- **Carousel item corner and spacing** as spec defaults. The component sets no corner, and spacing defaults to 0. The values 28 and 8 appear only in samples.
- **Button group sizes other than Small**. There are only `ButtonGroupSmallTokens` and `ConnectedButtonGroupSmallTokens`, both 40 dp.
- Split-button chevron rotation on check (sample-only).
- `RoundedPolygon.circle()` default `numVertices` (used by Oval) lives in `graphics-shapes`, not material3. It is believed to be 8 but was not fetched.
- Several tokens in source are flagged "incorrect" with TODOs, and the code overrides them: Large FAB icon 36 vs token 32, extended FAB Medium and Large icon–label gap 12/16 vs tokens 16/20, Medium FAB shape uses LargeIncreased because no token exists. Use the code values, which are listed above.

