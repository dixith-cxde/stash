# Material 3 Expressive motion, and how Stash implements it

This document covers how M3 Expressive motion works, the exact numbers behind it, and how each
part maps onto React Native with Reanimated 4.7 / Gesture Handler 3 / Skia in this app.

**Sources.** The numbers come from code, not from blog posts:

- AndroidX Compose material3 (`androidx-main`), cited as `AX/…`, which means
  `compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/…`
- MDC-Android `docs/theming/Motion.md` and `lib/java/.../transition/`
- Android developer guidance on predictive back
- Reanimated 4.7.1, read from `node_modules`

m3.material.io is a JavaScript-only site and could not be fetched. Every value marked
**(unverified)** is a reasoned choice, not a published number.

---

## 1. The model: physics, not curves

Classic Material (M2 and early M3) described motion as **duration + easing curve**: "this takes
300 ms with the emphasized curve". M3 Expressive replaces that for almost all UI motion with a
**motion physics system**: every animation is a **spring**, described by two numbers:

- **Damping ratio (ζ).** How much the spring bounces. ζ = 1 is *critically damped*: it arrives
  as fast as possible with no overshoot. ζ < 1 is *underdamped*: it overshoots and settles. The
  lower the value, the bouncier.
- **Stiffness (k).** How strong the spring is, which sets how fast it moves. Higher k is faster.

Springs have no fixed duration. They settle when their energy is used up. Two properties matter
for a fluid app:

1. **Interruptible.** A spring can be retargeted mid-flight, and it carries its current
   **velocity** into the new target. Tapping a filter chip twice quickly, or reversing a sheet
   drag, never jumps. Duration-based tweens can't do this.
2. **Gesture continuity.** When a finger lets go, the gesture's release velocity becomes the
   spring's starting velocity, so the motion continues the throw.

### Spatial vs. effects

Every token comes in two families, and choosing the right one is the most important motion rule:

| Family | Animate with it | Overshoot? | Why |
| --- | --- | --- | --- |
| **Spatial** | position, size, scale, rotation, **corner radius / shape** | Yes, in Expressive (ζ < 1) | Bounce on bounds and shape is the "expressive" character. |
| **Effects** | **color, opacity**, elevation/shadow, blur | Never (ζ = 1) | An overshooting alpha goes past 1, and an overshooting color goes past its target. Both show as flicker or a clamped jump. |

*Source: KDoc in `AX/MotionScheme.kt`.*

One animated change often uses **both**. A selected filter chip widens and rounds with a
spatial spring while its fill color changes with an effects spring. Never drive a color from
a spatial spring.

### Speeds

Each family has **fast**, **default** and **slow**:

- **fast:** small components, and anything the finger directly caused (press, toggle, chip, switch).
- **default:** medium elements: cards, sheets partway open, nav indicators, most layout changes.
- **slow:** large or full-screen motion: screen transitions, container transforms, big hero
  changes. Also for staggered sequences where calm matters more than speed.

---

## 2. Spring tokens

The Expressive scheme is the one Stash uses. The Standard scheme is listed for comparison: it
keeps the same speeds but removes nearly all bounce.

*Sources: `AX/tokens/ExpressiveMotionTokens.kt`, `AX/tokens/StandardMotionTokens.kt`, wired up
in `AX/MotionScheme.kt`. The MDC-Android `motionSpring*` attributes match Standard.*

| Token | Expressive ζ / k | Standard ζ / k |
| --- | --- | --- |
| `fastSpatial` | **0.6 / 800** | 0.9 / 1400 |
| `defaultSpatial` | **0.8 / 380** | 0.9 / 700 |
| `slowSpatial` | **0.8 / 200** | 0.9 / 300 |
| `fastEffects` | **1.0 / 3800** | 1.0 / 3800 |
| `defaultEffects` | **1.0 / 1600** | 1.0 / 1600 |
| `slowEffects` | **1.0 / 800** | 1.0 / 800 |

What they feel like (approximate settle times for a unit move):

- `fastSpatial`: about 0.25 s, with a visible ~10% overshoot. Snappy and playful.
- `defaultSpatial`: about 0.35 s, with a small ~2% overshoot. Confident.
- `slowSpatial`: about 0.5 s, the same small overshoot. Deliberate and calm.
- `fastEffects`: about 0.1 s. `defaultEffects`: about 0.15 s. `slowEffects`: about 0.22 s.
  None of them overshoot.

### Extra springs used by specific components

| Use | Spring | Source |
| --- | --- | --- |
| Loading-indicator shape morph | ζ 0.6, k 200, visibility threshold 0.1 | `AX/LoadingIndicator.kt` |
| Carousel snap | k 400 (`StiffnessMediumLow`), default ζ 1 | `AX/carousel/Carousel.kt` |

---

## 3. Easing and duration tokens (still used, but rarely)

Springs cover almost everything. Use timed motion only for:

- **looping** animation (the loading indicator's rotation, a blinking caret);
- **choreographed, non-interactive sequences** where the timing must be exact (a predictive-back
  commit, the stages of a fade-through);
- **progress mapping**: turning a gesture's 0..1 progress into a visual through an easing curve.

*Source: `AX/tokens/MotionTokens.kt`; MDC Motion.md agrees.*

### Easing curves

| Token | cubic-bezier | Use |
| --- | --- | --- |
| `emphasized` | path `M0,0 C.05,0 .133333,.06 .166666,.4 C.208333,.82 .25,1 1,1` (Compose collapses it to `0.2,0,0,1`) | Most timed transitions |
| `emphasizedDecelerate` | `0.05, 0.7, 0.1, 1` | Things entering |
| `emphasizedAccelerate` | `0.3, 0, 0.8, 0.15` | Things leaving for good |
| `standard` | `0.2, 0, 0, 1` | Small utility motion |
| `standardDecelerate` | `0, 0, 0, 1` | Predictive-back progress mapping |
| `standardAccelerate` | `0.3, 0, 1, 1` | |
| `legacy` | `0.4, 0, 0.2, 1` | Don't use (M2) |
| `linear` | `0, 0, 1, 1` | Rotation loops, progress |

### Durations (ms)

| | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| short | 50 | 100 | 150 | 200 |
| medium | 250 | 300 | 350 | 400 |
| long | 450 | 500 | 550 | 600 |
| extraLong | 700 | 800 | 900 | 1000 |

Rule of thumb: the larger the area and the distance, the longer the duration. Exits are shorter
than enters (e.g. SearchBar: enter `long4` 600 ms, exit `medium3` 350 ms, from `AX/SearchBar.kt`).

---

## 4. Translating springs to Reanimated 4

> ⚠️ This is the bug in the old `src/theme/tokens.ts`.

Reanimated 4.7 `withSpring` accepts **one of two** config shapes. Its types make them mutually
exclusive:

- **Physics mode:** `{ stiffness, damping, mass }`. The defaults are **mass 4**, damping 120, stiffness 900.
- **Duration mode:** `{ duration, dampingRatio }`. The actual duration is 1.5× the given value.

You **cannot** pass `{ dampingRatio, stiffness }`, which is how Compose describes its springs.

Compose's spring has an implicit **mass of 1** (ω₀ = √k). In Reanimated, ω₀ = √(k/m) and
ζ = c / (2√(k·m)). So:

```
mass = 1
stiffness = k
damping c = 2 · ζ · √k
```

### Converted tokens (always pass `mass: 1`)

| Token | `stiffness` | `damping` |
| --- | --- | --- |
| `fastSpatial` | 800 | 33.94 |
| `defaultSpatial` | 380 | 31.19 |
| `slowSpatial` | 200 | 22.63 |
| `fastEffects` | 3800 | 123.29 |
| `defaultEffects` | 1600 | 80.00 |
| `slowEffects` | 800 | 56.57 |
| loader morph | 200 | 16.97 |

If you forget `mass: 1`, the default mass of 4 halves ω₀ and the spring is twice as slow.

### Planned `src/motion/tokens.ts`

```ts
import type { WithSpringConfig } from 'react-native-reanimated';

const spring = (zeta: number, k: number): WithSpringConfig => ({
  mass: 1,
  stiffness: k,
  damping: 2 * zeta * Math.sqrt(k),
});

/** MotionScheme.expressive(), from AX/tokens/ExpressiveMotionTokens.kt */
export const Spring = {
  fastSpatial: spring(0.6, 800),
  defaultSpatial: spring(0.8, 380),
  slowSpatial: spring(0.8, 200),
  fastEffects: { ...spring(1, 3800), overshootClamping: true },
  defaultEffects: { ...spring(1, 1600), overshootClamping: true },
  slowEffects: { ...spring(1, 800), overshootClamping: true },
} as const;
```

Effects springs also set `overshootClamping: true`. ζ = 1 doesn't overshoot in theory, but a
release velocity pointing away from the target can still carry the value past it.

### Layout animations

`ComplexAnimationBuilder` presets accept the same physics:

```ts
LinearTransition.springify().mass(1).stiffness(380).damping(31.19)   // defaultSpatial
FadeIn.springify().mass(1).stiffness(1600).damping(80)                // defaultEffects
```

Wrap these in `src/motion/layout.ts` (`layoutDefault`, `enterFade`, …) so screens never write
raw numbers.

### The design canvas uses CSS approximations

The artboards animate with `transition: all .4–.45s cubic-bezier(.34,1.56,.64,1)`, an
overshooting CSS curve. A browser mockup can't run springs, so this curve only stands in for
one. **Don't port it.** In the app, every one of those transitions becomes a spring from the
table above (see the mapping in §8).

---

## 5. Shape: the other half of expressive motion

M3 Expressive treats shape as something that moves.

### Corner scale (dp)

| Token | Value |
| --- | --- |
| none | 0 |
| extraSmall | 4 |
| small | 8 |
| medium | 12 |
| large | 16 |
| largeIncreased | 20 |
| extraLarge | 28 |
| extraLargeIncreased | 32 |
| extraExtraLarge | 48 |
| full | 50% (pill / circle) |

*Source: `AX/tokens/ShapeTokens.kt`.*

### Press morph

A pressed button's corners **tighten**: round → squarer while the finger is down, and back on
release. From `AX/Button.kt` and the `Button*Tokens`:

| Button size | Height | Rest (round) | Rest ("square" variant) | Pressed |
| --- | --- | --- | --- | --- |
| XS | 32 | full | 12 | 8 |
| S | 40 | full | 12 | 8 |
| M | 56 | full | 16 | 12 |
| L | 96 | full | 28 | 16 |
| XL | 136 | full | 28 | 16 |

Compose animates the button press morph with **`defaultEffects`**, a deliberate *no bounce*
("to prevent any bounce in this component", `AX/Button.kt`). Toggle buttons, by contrast, morph
their checked/pressed shape with **`fastSpatial`** (bouncy), and their color with `defaultEffects`.

Stash's rule:

- **Buttons and icon buttons:** the press morph uses `defaultEffects`, as in the spec.
- **Selectable things** (toggles, filter segments, favorite, checkbox, chips) and **pressable
  cards**: shape and size use `fastSpatial`, color uses `defaultEffects`. This is where the bounce
  the design hints at comes from.
- **Pressed cards** (design: `.press:active { border-radius: 14px; transform: scale(.97) }`):
  the corner goes 28 → 14 and the scale 1 → 0.97 with `fastSpatial` on press-in. Release goes
  back with `defaultSpatial`, so it settles more gently than it pressed. **(unverified):** the
  0.97 scale and 14 dp corner come from the design, not from an M3 token.

### Shape morphing (MaterialShapes)

M3E has a library of **35 shapes** (`AX/MaterialShapes.kt`):

> Circle, Square, Slanted, Arch, Fan, Arrow, SemiCircle, Oval, Pill, Triangle, Diamond,
> ClamShell, Pentagon, Gem, Sunny, VerySunny, Cookie4Sided, Cookie6Sided, Cookie7Sided,
> Cookie9Sided, Cookie12Sided, Ghostish, Clover4Leaf, Clover8Leaf, Burst, SoftBurst, Boom,
> SoftBoom, Flower, Puffy, PuffyDiamond, PixelCircle, PixelTriangle, Bun, Heart

How they work (`androidx.graphics:graphics-shapes`):

- Each shape is a `RoundedPolygon`: vertices plus `CornerRounding(radius, smoothing)`. Every
  corner becomes 1–3 cubic Béziers.
- `Morph(a, b)` matches the cubics of the two shapes by position, vertex distance and concavity.
  It splits curves until both sides have the **same number of cubics**.
- `toPath(t)` then interpolates each control point linearly.

The design's cookie and clover backgrounds on collection cards (Cookie9Sided, Cookie4Sided,
Clover4Leaf) are these shapes.

#### How Stash does it

1. **Geometry:** `src/shapes/geometry.ts` is a line-for-line port of `RoundedPolygon` and
   `CornerRounding`, including smoothing. `src/shapes/materialShapes.ts` holds the 35
   definitions with Google's values, normalized like `normalized()`.
2. **Matching:** `src/shapes/morphMatch.ts` ports `Morph.match`. It measures both outlines,
   pairs convex corners with convex corners and concave with concave, then cuts both outlines
   into partner cubics. Corners stay corners mid-morph. Pairs are cached per shape pair, in JS.
3. **Runtime:** `morphPath` is a worklet that interpolates each partner pair and draws a Skia
   cubic path (`Morph.toPath`). There is no React re-render per frame.
4. **Fit:** rotating shapes are scaled by their max radius (`calculateMaxBounds`), so they
   never clip at any angle and every shape reads at the same size.
5. **Interruptions:** a new target mid-morph is matched from the outline as currently drawn,
   so it never jumps.
6. **Don't use** `puffy` or `heart` (`EXCLUDED_SHAPES`). Pick from `USABLE_SHAPES`.

Never interpolate raw SVG strings or point lists of different lengths. That distorts the shape.

### Loading indicator (exact spec)

From `AX/LoadingIndicator.kt`:

- **Indeterminate sequence:** SoftBurst → Cookie9Sided → Pentagon → Pill → Sunny → Cookie4Sided → Oval, then repeat.
- A new morph starts every **650 ms**. Each morph is `spring(ζ 0.6, k 200)`.
- Each morph also turns the shape **+90°**. On top of that, a global rotation of
  **360° per 4666 ms** runs linearly.
- **Determinate:** morphs Circle (rotated 18°) → SoftBurst with progress, plus `−progress × 180°` of rotation.

Stash uses this for preview fetching, PDF text extraction and the "Saving…" state.

---

## 6. Transitions between screens

### Container transform (card → page)

Use it when the user taps a card that *is* the thing being opened: feed card → Item detail,
collection card → Collection hero, note card → Note, search pill → Search.

The card's bounds and corner radius grow into the destination layout:

- **Bounds** (x, y, w, h) use `slowSpatial` (opening a page is the largest motion in the app).
- **Corner radius** goes 28 → 0, or for the design's hero, into the 40 dp bottom corners. Use the
  same `slowSpatial` value.
- **Content cross-fade** follows the MDC thresholds, mapped onto the bounds progress p ∈ 0..1:
  - Enter: the outgoing card content fades out over p 0–0.25. Incoming page content fades in
    after 0.25.
  - Return: the page content fades over p 0.6–0.9.
  - The shape mask resolves over p 0–0.75 on enter, and 0.3–0.9 on return.
- **Scrim** behind the growing container goes 0 → 32% black, using `defaultEffects`.
- The hero's color matches the card's color, so the surface reads as the same object.

**Implementation:**

1. Measure the source card (`measure()` in a worklet).
2. Navigate.
3. A root-level portal draws a copy of the card that springs to the destination's measured
   frame.
4. When the spring settles, hide the overlay and show the real page.

Back runs the same steps in reverse with **velocity carried over** from predictive back. Reanimated's
own shared-element transitions are experimental (static flag
`ENABLE_SHARED_ELEMENT_TRANSITIONS`, off by default, native stack only, default 500 ms
`withTiming`), so Stash builds its own.

### Shared axis

For parent/child pages that aren't the same object: Note → Editor, Settings subpages.

- Outgoing page: slides 30 dp and fades out. Incoming page: slides from 30 dp and fades in.
  Use the Y axis for Note → Editor and the X axis for sibling steps.
- Slide uses `defaultSpatial`, fade uses `defaultEffects`.
  - MDC's timed version: `long1` (450 ms) with `emphasized` easing. Slide distance from MDC
    `mtrl_transition_shared_axis_slide_distance`.

### Fade through

For switching tabs (Home ↔ Library ↔ Highlights ↔ Search), where the screens aren't related.

- The outgoing screen fades out over the first ~35%.
- The incoming screen fades in and scales **0.92 → 1**.
- Fade uses `defaultEffects`, scale uses `defaultSpatial`. MDC's timed version is `long1` with emphasized easing.
- The floating nav bar doesn't take part. Only its indicator moves (§7).

### Predictive back (Android 14+; `predictiveBackGestureEnabled` is already on in `app.json`)

The gesture's progress (0..1) goes through `standardDecelerate` (0,0,0,1) and drives a *preview*.
On release, the app either commits or cancels.

**Full-screen pages:**

- The current page scales **100% → 90%**.
- The page underneath scales 110% → 100%.
- Cross-fade threshold at **35%** of progress.
- Commit uses `cubic-bezier(0.1, 0.1, 0, 1)`.

**Container-transformed pages** (Item detail, Collection, Note) shrink back toward their card:

- Minimum scale **90%**.
- Shift toward the swipe edge by at most `width/20 − 8` dp on X and `height/20 − 8` dp on Y,
  keeping an **8 dp margin**.
- Corners round up while the preview runs. **(unverified):** 28 dp at full progress, since no
  official value was found.
- On commit, the container transform runs in reverse with the gesture's velocity, using
  `slowSpatial`. Google recommends a subtle overshoot on shared-element return, which this spring
  gives.
- A cancel springs back to 100% with `defaultSpatial`.

**Sheets** (Capture): predictive back drags the sheet down and scales it slightly. Commit
dismisses with the fling velocity.

---

## 7. Component motion catalog

All values come from the Compose M3 source unless marked otherwise.

| Component | What moves | Spring |
| --- | --- | --- |
| Button / IconButton | press shape morph (table in §5) | `defaultEffects` |
| | container and content color | `defaultEffects` |
| Toggle button, favorite (Detail ★) | pressed/checked shape: square 12 → round 28 | `fastSpatial` |
| | color | `defaultEffects` |
| **Connected button group** (Home and Collection filters, Capture collection picker) | the pressed segment grows by **15%** of its width (`ExpandedRatio = 0.15`) and its neighbors shrink to make room | `fastSpatial` |
| | selected segment: inner corners 8 → 20 (fully round), `flex-grow` 1 → 1.4 (design) | `fastSpatial` |
| | fill color | `defaultEffects` |
| Split button (Detail Read/★/Share, Capture Save/⌄) | shape and color | `defaultEffects` |
| | trailing chevron rotates 180° when open | `fastSpatial` |
| FAB menu (long-press +) | items stagger in: a `slowEffects` spring over the item count | `slowEffects` |
| | each item: width grows with `fastSpatial`, alpha with `fastEffects` | |
| | the FAB morphs + → × | `fastSpatial` |
| Floating nav bar | selected indicator: size, pill width, label reveal | `fastSpatial` |
| | indicator alpha and colors | `defaultEffects` |
| | icon position shift | `defaultSpatial` |
| Floating toolbar hide on scroll | toolbar slides off when scrolling down and returns when scrolling up; snaps on release | snap: `defaultEffects`; fling: decay |
| Navigation rail (tablet, later) | expand | `defaultSpatial` |
| Switch | thumb | `fastSpatial` |
| Checkbox (Note checklist) | box shape morph 7 → 11 dp corner, check draw-in | `defaultSpatial` |
| | fill | `fastEffects` / `defaultEffects` |
| | strike-through and text color | `defaultEffects` |
| Chips (tags, suggested tags) | selected leading ✓ fades in with `slowEffects` and out with `fastEffects` | |
| | width expands with `fastSpatial` and shrinks with `defaultEffects` | |
| | corner 10 → 18 when selected (design) | `fastSpatial` |
| Top app bar / large title collapse | snap after scroll | `defaultEffects` |
| Bottom app bar | snap | `fastSpatial` |
| Carousel / collection rail | snap | k 400 |
| Search pill → Search | container transform: enter `long4` 600 ms, exit `medium3` 350 ms; back preview min scale 0.9, 8 dp margin, max Y 24 dp | |
| Progress bar (PDF, checklist) | width | `defaultSpatial` |
| Bottom sheet | drag follows the finger 1:1 | |
| | release springs to the detent with the fling velocity | `defaultSpatial` |
| | dismiss | `fastSpatial` + velocity |
| | scrim | `defaultEffects` |
| Snackbar ("Saved · Undo") | enters from below | `defaultSpatial` |
| | leaves with a fade | `fastEffects` |
| List insert / remove / reorder | `LinearTransition` | `defaultSpatial` |
| | entering items | `defaultEffects` fade + 8 dp rise **(unverified)** |

---

## 8. Every motion moment in the Stash design

What each interaction in the canvas becomes in the app.

**Global**

- **Press on any `.press` card or tile:**
  - corner 28 → 14 and scale 0.97 with `fastSpatial`;
  - release with `defaultSpatial`;
  - light haptic (`Haptics.selectionAsync`) on press-in.
- **Tab change:**
  - fade through (§6);
  - the nav indicator pill slides to the new tab, its width changes as the label appears, and the label fades in (`fastSpatial` / `defaultEffects`).
- **Scrolling a tab:** the floating nav bar and FAB hide on scroll down and show on scroll up. The FAB stays visible while the bar is hidden **(unverified choice)**.

**Home**

- **"Stash" large title:** shrinks into a compact top bar on scroll. The type scale interpolates with scroll, and the bar snaps with `defaultEffects`.
- **Search pill:**
  - press uses the card morph;
  - tap runs the container transform into the Search tab.
- **Collections rail:** horizontal snap with k 400. The "New collection" dashed card pulses its border **(unverified)**.
- **Filter button group** (All / Links / PDFs / Notes / Quotes):
  - the selected segment widens and rounds (`fastSpatial`);
  - the color changes (`defaultEffects`);
  - the pressed segment squishes its neighbors by 15%.
- **Masonry feed on filter change:**
  - cards that stay reflow to their new place with `LinearTransition` (`defaultSpatial`);
  - removed cards fade out and scale to 0.92 (`fastEffects`);
  - new cards fade in and rise (`defaultEffects` + `defaultSpatial`).
- **Feed card tap:** container transform into Detail or Note.
- **FAB:**
  - tap opens the Capture sheet, with the FAB morphing into the sheet's top edge;
  - long-press opens the FAB menu: Link from clipboard / Note / File.

**Library**

- **Smart view tiles and collection cards:** press morph, then a container transform into Collection.
- **Card cookie/clover decorations:** they rotate slowly and morph between two shapes on press, using the loader morph spring. This is subtle ambient motion **(unverified)**.
- **"Recent" sort button:** the icon rotates 180° (`fastSpatial`). The list reorders with `LinearTransition`.

**Collection**

- **Hero:** it is the destination of the container transform. On scroll:
  - the hero collapses: its height and bottom corners (40 → 28) shrink, the title scales down, and the decoration shifts with parallax at 0.5× scroll;
  - snapping uses `defaultEffects`.
- **List ↔ grid toggle:**
  - each item morphs between row and tile, driven by layout transitions with `defaultSpatial`;
  - the cover tile's height animates 56 → 96;
  - the icon cross-fades with `fastEffects` while rotating 90° with `fastSpatial`.
- **Add / New note / Share connected group:** the button press morph (§5).

**Item detail**

- **Hero:** shrinks with scroll as in Collection.
- **Read / ★ / Share split row:** the ★ toggle morphs square ↔ round and its color changes to tertiary.
  - Haptic on toggle-on: `Haptics.impactAsync(Light)`.
- **Suggested tags:** tapping one moves the chip into the tag row with `LinearTransition`.
- **Highlight cards:** enter with a stagger of 40 ms per card **(unverified)** and `defaultEffects`.
- **"Your note" field:** the label color changes on focus (`fastEffects`).

**Capture sheet**

- **Open:** springs up from the FAB with `defaultSpatial` and drag-to-dismiss.
  - The keyboard is tracked frame by frame with `react-native-keyboard-controller`, so the sheet rides the keyboard and never jumps.
- **Link / Note / File mode tabs:**
  - the selected pill slides between segments (`fastSpatial`);
  - the content below cross-fades (`defaultEffects`);
  - the sheet's height animates to the new content (`defaultSpatial`).
- **Tag chips and collection group:** as above.
- **Save → saved state:**
  - the Save button morphs into the success layout: the check shape morphs from the loader's last shape (Oval) to a Cookie shape and scales in with `fastSpatial`;
  - success haptic (`notificationAsync(Success)`);
  - the content cross-fades.
- **Undo:** reverses the morph.

**Note**

- **Checklist row toggle:**
  - the checkbox morphs and fills;
  - the progress bar width uses `defaultSpatial`;
  - the "2 of 4 done" number rolls (digits slide vertically, `fastSpatial`).
- **Copy code:** the label cross-fades Copy → Copied (`fastEffects`), with a light haptic.
- **Edit:** shared axis Y into the Editor.

**Markdown editor**

- **Write / Preview tabs:** the indicator slides; the content uses a shared axis X (forward = preview).
- **Formatting toolbar:**
  - rides the keyboard;
  - the active-format button morphs round (toggle rules);
  - the toolbar scrolls horizontally with overscroll.
- **Saved indicator:** "Saving…" shows a tiny loader, then cross-fades to "Saved ✓" (`defaultEffects`).
- **Caret:** blinks at 1.1 s in steps. This is timed, not a spring.

---

## 9. Haptics

**(unverified)** Google's Compose M3 components don't call haptics in their motion code, and no
primary M3E haptics spec could be fetched. Stash follows Android's own conventions:

| Moment | expo-haptics call |
| --- | --- |
| Press-in on a card or button | none (the visual is enough) |
| Selection change (filter, chip, segment), but **not** nav-bar tab switches | `selectionAsync()` |
| Toggle on (favorite, checkbox) | `impactAsync(Light)` |
| Save succeeded | `notificationAsync(Success)` |
| Delete / destructive confirm | `notificationAsync(Warning)` |
| Sheet or predictive back passes its commit threshold | `impactAsync(Light)`, once per crossing |

Fire the haptic when the action takes effect (selection, threshold, commit), not at the end of
the spring.

---

## 10. Engineering rules

1. **Never write raw numbers in screens.** Import from `src/motion/tokens.ts`.
2. **Animate on the UI thread.** Use shared values, `useAnimatedStyle` and `useAnimatedProps`, and
   run gesture handlers as worklets. React state changes start animations but never drive frames.
3. **Animate transform and opacity first.** Animating `width`/`height`/`borderRadius` triggers
   layout or a re-raster each frame, so use them only where the spec needs it (button group
   widths, card corners). Keep those views light.
4. **Always carry velocity.** Pass `velocity` from gestures into `withSpring`. Never `cancelAnimation` and restart from 0.
5. **Spatial for bounds, effects for color and alpha.** Effects springs clamp overshoot.
6. **Reduced motion.** Every animation runs with `ReduceMotion.System`. When the user's
   accessibility setting reduces motion:
   - spatial springs become `defaultEffects` (no bounce);
   - container transforms become fades;
   - looping decoration stops;
   - the loading indicator falls back to a slow rotation without morphing.
7. **120 Hz budget.** Keep UI-thread work under 8 ms per frame, and test on the USB phone with
   the "Profile HWUI rendering" bars.
8. **Lists.** FlashList recycles cells. Key layout animations to item ids and skip `entering` on
   recycled mounts (track first-seen ids), or cells replay their entrance while scrolling.
9. **Interruptions are normal.** Every interactive animation must look right when it is reversed
   halfway: a double tap, a drag reversal, a back during the open transition.

---

## Appendix: source links

- AndroidX material3:
  <https://github.com/androidx/androidx/tree/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3>
  — `MotionScheme.kt`, `tokens/ExpressiveMotionTokens.kt`, `tokens/StandardMotionTokens.kt`,
  `tokens/MotionTokens.kt`, `tokens/ShapeTokens.kt`, `Button.kt`, `ButtonGroup.kt`, `ToggleButton.kt`,
  `SplitButton.kt`, `FloatingActionButtonMenu.kt`, `LoadingIndicator.kt`, `FloatingToolbar.kt`,
  `NavigationBar.kt`, `Chip.kt`, `AppBar.kt`, `SearchBar.kt`, `MaterialShapes.kt`, `carousel/Carousel.kt`
- Graphics shapes: <https://developer.android.com/develop/ui/compose/graphics/draw/shapes>
- MDC-Android motion: <https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md>
- Predictive back: <https://developer.android.com/design/ui/mobile/guides/patterns/predictive-back>
- Reanimated `withSpring`: <https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/>
- Reanimated shared elements: <https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview/>
