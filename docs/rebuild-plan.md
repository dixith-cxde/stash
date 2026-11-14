# Stash rebuild plan (v3: fluid React Native)

Status (2026-11-14): phases 1–6 done. Designed screens are built on real data: Home, Library, Collection
(+ smart views), Item detail, Capture sheet, Note, Markdown editor. Next: phase 7 (Highlights, Search,
PDF reader, Settings, Tag). Dev routes: `stash://dev/shapes`, `/dev/kit`, `/dev/transitions`,
`/dev/seed` (design sample data; `?clear=1` removes it). Haptics: save / cancel / delete only.

Target design: the Design canvas *Stash — M3 Expressive redesign*
(<https://claude.ai/artifact/ApNigGtc6hbe7MB9Mw5Bte>), seven 390×844 artboards:
Home, Library, Collection, Item detail, Quick-save sheet, Markdown editor, Note.
Motion reference: [animation.md](./animation.md).

## 0. Purpose

**Read & remember:** save anything, read it later, keep what matters, find it again.

Stash is a calm read-it-later app and personal knowledge inbox:

- **Capture:** one tap, from any app.
- **Reading queue:** what's saved and still to read.
- **Keep what matters:** highlights and notes.
- **Recall:** smart local search.
- **Intake:** RSS feeds, with one-tap save of the articles worth keeping.

Decided 2026-11-14:

- **Search:** the Home search pill is instant keyword search (FTS5). The Search tab is
  "smart" local search: FTS plus synonyms, fuzzy and prefix matching, and weighting by tags,
  collections and sites. No AI model and no network: it has to stay light and battery-efficient.
- **Feeds:** RSS/Atom feeds get their own tab, replacing the Highlights tab. Highlights stay as
  a smart view in Library, so the tabs are Home, Library, Feeds, Search. Feeds refresh in the
  background a few times a day, never constantly.

## 1. The decision

v1 and v2 drew the UI with Jetpack Compose (`@expo/ui` plus about 2,300 lines of Kotlin in
`modules/expressive/.../stash/`). Each screen was a Compose island inside React Native
navigation. That setup was the main reason the app felt rigid:

- Nothing animates *between* screens. A card can't grow into the detail page, because the card
  belongs to one Compose host and the page to another.
- Gestures (sheet drags, predictive back, swipe on rows) are split between two UI systems.
- Every design change needs Kotlin, a native rebuild, and a second state layer (records
  serialized across the bridge in `features/native/records.ts`).

**v3 renders everything with plain React Native views, Reanimated 4, Gesture Handler 3 and
Skia.** The M3 Expressive look (color roles, type, shape) and motion (spring tokens) become a
TypeScript token layer, so each pixel and each spring is under our control and matches the
design. The small native helpers that have no RN equivalent stay in Kotlin.

## 2. Reuse audit

Each file below was read. The rule: keep only what can be reused without problems; rebuild the rest.

### Keep as is

| Path | Why it's safe |
| --- | --- |
| `src/db/schema.ts`, `client.ts`, `hooks.ts` (`useDbQuery`), `filters.ts`, `repo.ts` | Pure data layer with no UI imports. `useDbQuery` already coalesces change events per frame. |
| `drizzle/` (migrations, FTS5 triggers) | Working. New columns go in a new migration (see §4). |
| `src/features/capture/normalize.ts`, `save.ts`, `quickAdd.ts` | UI-free. `quickAdd` only calls `router.push('/capture')`. |
| `src/features/preview/*` (OpenGraph + YouTube oEmbed) | UI-free and tested. |
| `src/features/suggest/*` (tag/folder suggestions) | UI-free. The design's "Suggested tags" uses it directly. |
| `src/features/backup/*` (JSON + Netscape import/export) | UI-free and tested. |
| `src/lib/format.ts`, `src/state/capture.ts`, `src/state/settings.ts` | Plain TS and zustand. Settings persist through `expo-sqlite/kv-store`. |
| `src/__tests__/*` | The 4 suites cover normalize, parseMeta, netscape and filters. |
| `assets/fonts/GoogleSansFlex-*.ttf` + `expo-font` config | The design uses Google Sans Flex, so these files stay. |
| `plugins/withProcessText.js`, `expo-share-intent` config | Capture entry points. |
| `modules/expressive/.../ExpressiveModule.kt` (the `renderPdfPage` and `takePendingProcessText` functions plus the event) | Native-only work with no RN equivalent. |

### Keep, with changes

| Path | Change |
| --- | --- |
| `src/theme/palette.ts` | Keep the `SchemeExpressive` 2025 generator. Replace the `MaterialColors` type from `@expo/ui` with our own `ColorRoles` type. Add `collectionTones(hue)`, which gives the per-collection container/on-container pairs the design uses (e.g. `#4F378B`/`#EADDFF` is tone 30/90 of the purple hue). |
| `src/theme/AppTheme.tsx` | Keep the provider and `useColors()`. Remove `Host`/`AppHost`. Dynamic (wallpaper) color moves from `useMaterialColors` to a new `getDynamicColors()` function in `ExpressiveModule.kt`, which reads `android.R.color.system_*` tones. |
| `src/theme/tokens.ts` | **Rewrite.** Its spring tokens pass `{ dampingRatio, stiffness }`, but Reanimated 4.7's `SpringConfig` accepts *either* `{ stiffness, damping, mass }` *or* `{ duration, dampingRatio }`, and its default mass is 4. The fix is in animation.md §4: convert to `damping = 2·ζ·√(k·m)` with `mass: 1`. Keep the corner, spacing and button-size scales. |
| `src/theme/types.ts` (`TYPE_META`) | Keep the type → label/icon/role map. Shape names now point at our TS shape library, not the Kotlin enum. |
| `src/theme/icons.ts` + `assets/icons/*.xml` | The XML drawables are Compose-only. Convert each `pathData` to an SVG path once with a script, render through `react-native-svg`, and keep the `Ico` name map. New icons still come from `@expo/material-symbols`, then go through the converter. |
| `src/features/files/storage.ts`, `src/features/capture/CaptureListener.tsx` | Keep. Only the import path of `ExpressiveModule` changes. |
| `src/lib/nav.ts` | Keep `openItem`. Remove `browse` (smart views become `collection/[id]` routes). |

### Drop

| Path | Reason |
| --- | --- |
| `@expo/ui` dependency, `AppHost` | No Compose in v3. |
| `modules/expressive/.../stash/*.kt` (Home, Detail, QuickSave, Cards, NavToolbar, Common, Records) | Replaced by RN screens. |
| `ConnectedButtonGroupView.kt`, `FabMenuView.kt`, `MorphingShapeView.kt`, `ExpressiveThemeView.kt`, `modules/expressive/src/views.tsx`, `stash.tsx` | Replaced by RN components. |
| `src/features/native/records.ts` | Bridge serializers for Compose. |
| Every route file under `src/app/` and every file under `src/components/` | Built around Compose hosts. Rebuilt per the design. |
| **`modules/expressive/android/build/` (443 files tracked in git, including `classes.dex`)** | Build output was committed in `85b1c91`. Run `git rm -r --cached` on it and add `build/` to `.gitignore`. |

## 3. New dependencies

Install all of them with `npx expo install` (SDK 58 pins in parentheses):

| Package | Used for |
| --- | --- |
| `react-native-svg` (15.16.0) | Icons and static decorative shapes. |
| `@shopify/react-native-skia` (2.14.0) | Shape morphing on the UI thread (`Skia.Path` interpolation), the loading indicator, and the cookie/clover backgrounds that animate. |
| `@shopify/flash-list` (2.3.2) | Masonry feed on Home and long Collection lists, with recycling. |
| `react-native-keyboard-controller` (1.22.7) | Keyboard-synced sheet and editor toolbar movement (frame-accurate, not `KeyboardAvoidingView`). |
| A Markdown lexer (`marked` lexer only, or `markdown-it`) | Parse notes into tokens. We render the tokens with our own components. |

Already installed and used more: `react-native-reanimated` 4.7.1, `react-native-gesture-handler` 3.3,
`react-native-worklets`, `expo-haptics`, `expo-image` (cover cross-fades).

Removed: `@expo/ui`.

## 4. Data changes the design needs

| Design element | Schema today | Change |
| --- | --- | --- |
| Collection icon glyph (book, bookmark, layers…) | `folders` has `shape`, `color` | Add `folders.icon` (an icon name). |
| Collection color pairs | `folders.color` (hex) | Store a seed hue. The UI derives container/on-container tones in both themes. |
| PDF "Page 6 of 15" + progress bar | none | Add `bookmarks.page_count`, `bookmarks.last_page`. |
| Link "7 min read" | none | Add `bookmarks.word_count`, filled by the preview fetcher. |
| Video "18:42" | none | Add `bookmarks.duration_sec`, from oEmbed or meta. |
| Note checklist "2 of 4 done" | Markdown in `content` | Derived when rendering. No column. |
| Note `[[Saved item]]` links | none | Parse at render and resolve by title through FTS. A link table can come later. |
| Highlight "Paragraph 4" | `highlights.page` | Reuse `page` as the position index. Add `position_label` if needed. |
| Smart views (All, PDFs, Notes, Highlights) | `lists.kind = 'smart'` | Seed four built-in smart lists in a migration. |

## 5. Route map

| Route | Artboard | Presentation |
| --- | --- | --- |
| `(tabs)/index` | Home | Tab. Floating nav bar and FAB. |
| `(tabs)/library` | Library | Tab. |
| `(tabs)/highlights` | *not designed* | Tab. Built from the same kit as Collection. |
| `(tabs)/search` | *not designed* | Tab. The Home search pill grows into it (container transform). |
| `collection/[id]` | Collection | Stack. The card grows into the hero header. |
| `item/[id]` | Item detail | Stack. The feed card grows into the hero. |
| `note/[id]` | Note | Stack. Container transform from the note card. |
| `note/[id]/edit` | Markdown editor | Stack. Shared axis Y. |
| `capture` | Quick-save sheet | Custom transparent modal with our own gesture-driven sheet, not the native sheet, so it can follow the spec springs and drag velocity. |
| `pdf/[id]`, `tag/[id]`, `settings` | *not designed* | Built from the same kit. |

Tabs use a custom tab bar. Switching tabs is a fade through (animation.md §6) run by the tab
navigator on the native driver. Stack screens use a JS-driven transition so the container transform and
predictive back share one spring system.

## 6. Code layout

```
src/
  app/                 routes only (thin; compose screens from below)
  motion/              tokens.ts (springs, durations, easings) · springs.ts (helpers)
                       usePressMorph · useScrollChrome · useReducedMotion
                       ContainerTransform (measure → overlay → grow) · SharedAxis · FadeThrough
  shapes/              materialShapes.ts (35 shapes as normalized cubic paths, ported from
                       androidx.graphics.shapes) · morph.ts (equal-segment path pairs, worklet lerp)
                       <Shape>, <MorphingShape>, <LoadingIndicator>
  ui/                  design-system components (one folder each):
                       Surface, Text (type scale), Ico, Button, IconButton, ButtonGroup
                       (connected, width-squish), SplitButton, FAB, FloatingNavBar, SearchPill,
                       Chip/TagChip, Checkbox, ProgressBar, Sheet, Snackbar, LargeTitle, HeroHeader,
                       BackPill, SectionLabel
  features/
    feed/              FeedMasonry, cards: LinkCard, PdfCard, NoteCard, QuoteCard, VideoCard
    collections/       CollectionCard, SmartViewTile, CollectionHero, ItemRow, ItemTile
    detail/            OrganizeCard, HighlightList, NoteField
    capture/           (kept logic) + CaptureSheet UI: mode tabs, LinkPreview, NoteDraft, FilePick
    notes/             markdown lexer wrapper, MarkdownView, MarkdownEditor (syntax-tinted input),
                       FormatToolbar
    …kept: preview, suggest, backup, files
  db/ state/ lib/      kept
  theme/               palette, AppTheme (no Compose), type scale, icons
```

## 7. Build order

Each phase ends with typecheck, lint, tests and a debug build on the USB phone.

1. **Clean slate.** Untrack the `build/` output. Remove `@expo/ui`, the Compose views and
   the old screens and components. Add `getDynamicColors()` to the Kotlin module. Install the new
   dependencies. The app boots to an empty themed shell.
2. **Foundation.** Color roles and collection tones, type scale (Google Sans Flex, the
   weights and letter-spacing used in the design), shape scale, motion tokens (animation.md),
   `Ico` on SVG, `Surface` + `usePressMorph`, haptics helpers.
3. **Shapes.** Port the MaterialShapes polygons and the morph to TS/Skia. Check them by eye
   against the Compose loading indicator. Build `<Shape>`, `<MorphingShape>` and `<LoadingIndicator>`.
4. **Component kit.** Buttons, connected ButtonGroup (selected item widens, neighbors
   squish), SplitButton, FAB, FloatingNavBar (pill indicator slides and resizes),
   SearchPill, chips, checkbox morph, progress, sheet, snackbar. Each one gets a `__dev__/kit` route
   so it can be checked in isolation.
5. **Navigation shell and transitions.** Tabs with a custom bar, fade through between tabs,
   stack container transform, shared axis, predictive back, and the scroll-driven toolbar
   hide/show.
6. **Screens, in design order:** Home → Library → Collection → Item detail → Capture sheet →
   Note → Editor. Each screen is wired to real `repo.ts` queries from the start, with no mock data.
7. **Undesigned screens:** keyword search (from the Home pill), smart Search tab, PDF reader
   chrome, Tag, Settings. Built from the same kit.
8. **Feeds (RSS/Atom):** a Feeds tab with tonal source cards, an article list and the container
   transform into a clean reader; one tap saves to Stash. Feeds refresh in the background
   with battery-friendly scheduling. Add a feed by URL or by site (feed autodiscovery).
9. **Motion polish pass.** Run through animation.md §10 on device. Check reduced motion and
   that frame times stay under 8 ms on 120 Hz.
10. **Docs.** Update README and AGENTS.md: remove the Compose rules, describe the RN kit and
   motion rules.

## 8. Risks and open questions

- **Shared-element transitions.** Reanimated 4.7 ships `SharedTransition`, but the
  `ENABLE_SHARED_ELEMENT_TRANSITIONS` static flag is off by default and marked experimental.
  The plan builds our own container transform (measure the card, mount a portal overlay,
  spring its bounds and corner radius into the destination layout, then hand off). It works
  today and keeps the M3 spring tokens. We can try the flag behind a setting later.
- **Markdown editor.** The design tints Markdown syntax as the user types. An RN `TextInput`
  with nested `<Text>` children can style ranges on Android, but caret and IME behavior needs
  testing early. Fallback: an overlay that shows plain text plus a tinted mirror. Prototype
  this in phase 4, not phase 6.
- **Masonry with recycling and layout animations.** FlashList 2 masonry recycles
  cells. Entering/exiting layout animations have to be keyed carefully so recycled cells
  don't replay them. Filter changes on Home animate with a shared-value-driven reflow, not
  with remounts.
- **Light theme.** The design is dark only. Light comes from the same tonal roles. Should it
  get its own artboard pass?
- **Undesigned screens:** Highlights, Search, PDF reader, Settings, Tag (see phase 7).
