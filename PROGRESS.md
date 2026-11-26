# Stash — working notes

Short, current context for whoever picks this up (human or Claude). Keep it under ~80 lines;
history lives in git. Plan: `docs/rebuild-plan.md`. Motion: `docs/animation.md`. Rules: `AGENTS.md`.
Design canvas: https://claude.ai/artifact/ApNigGtc6hbe7MB9Mw5Bte (row 3 = Feeds boards).

## Product
"Read & remember": save anything, read later, keep what matters, find it again. Local-only
(SQLite), Android-first, Expo SDK 58 / RN 0.88, pure RN + Reanimated 4 + RNGH 3 (no Compose).
Tabs: Home · Library · Feeds (RSS) · Search. Highlights live in Library's smart view.
No AI / no cloud. Battery matters: no background polling.

## Done (committed on feat/stash-v1)
- Phases 1–6: foundation, M3E motion tokens, shapes, kit, transitions, designed screens.
- Phase 7 (part): keyword search page `/find` from the Home pill.
- Phase 8: Feeds tab per canvas (sources rail, New/All/Saved, top story, day groups, empty
  state with popular feeds), article reader with reader mode (fetch + extract on first open,
  cached in `feed_items.article`), swipe right save / left hide (Undo), long-press menu.
- Perf: native-driver tab fade, tab preload, UI-thread card measure, deferred page body.

- Phase 7 (more): smart local Search tab (prefix + stemming, 124 synonym groups, typo fix via
  fts5vocab migration 0005, tag/collection/site weighting, scopes, recent searches), Settings
  (theme, color, reader mode, backup), new/edit collection sheet, tag pages
  (`/collection/tag-<id>`), deep links open over Home.

## Done 2026-11-14 (released as v1.0.0)
- Phone check: Search tab and Settings look right (the gear at top-left is the dev-client
  tools button, not the app). Collection sheet fixed: Name field sits above the scroll area,
  so the keyboard no longer hides it. "#by" tag on the phone is old test data.
- Phase 7 PDF reader `src/app/pdf/[id].tsx` + `src/features/pdf/`: native page render, cached
  per width in cache/pdf/<id>, 4 pages around the current one rendered one at a time,
  resume at `last_page`, saves page (debounced), fills `page_count`, marks read, "Page x of
  n" pill (tap → Go to page), tap toggles chrome, scrolling down hides it, menu: go to page,
  first page, open in another app. `openItem` routes PDFs here; delete clears the cache;
  saving a PDF stores `page_count`. Pages laid out at page 1's aspect (fast jumps). No zoom yet.
- Phase 9 code pass: raw/default fades → effects-spring presets (`fadeIn`/`fadeOut`/
  `enterFade`/`exitFade` in `src/motion/layout.ts`); reduced motion: TransitionScreen
  cross-fades (`fadeTo`), tabs fade without scale (`TAB_TRANSITION_REDUCED`), loader keeps
  spinning. Left for a decision: container opens on defaultSpatial (doc says slowSpatial),
  scrims track position, `useSprings` StandardSpring swap is dead under ReduceMotion.System.
- Feeds speed (older phones): one lean query for all three tabs (no article bodies, summary
  cut to 600 chars; New/All/Saved filtered in memory), unchanged rows keep identity so memo
  rows skip renders, FlashList with recycling (SwipeRow/menu reset per article),
  `useDeferredValue` for the list, refresh on focus delayed 1.2 s. ButtonGroup selection now
  moves on the UI thread in the tap worklet (`useSharedSelection`, `onPressWorklet`), so all
  segment groups respond before React re-renders. Phone has only 23 feed items: remaining lag
  is likely the dev build; try a release build.
- Reader (`article/[id]`, `src/features/reader/`): justified reading text, metadata card
  (source, author, absolute + relative date, read time), measured images with captions and
  tap-to-zoom, Discussion band (HN thread card with points/comments; page comments as cards
  with authors, reply rails). The "#1 #2" was the extractor keeping forum `<article>` posts;
  comments are now lifted out and stored as `<!-- stash:… -->` lines (old caches parsed too).
- Files and links: `.md`/`.txt`/code/csv files saved as type file with a 16 KB excerpt, new
  viewer `/file/[id]` (200 KB cap), item-page `FilePreview` (PDF thumb, image, text lines),
  `linkKind(url)` → app / repo / package / docs / video / link, shown on cards and item page.
- Phase 10 docs: README rewritten for v3, AGENTS.md rules updated, rebuild-plan status.

## Done 2026-11-14 (after v1.0.2, not on device yet)
- Item page action by type (`openAction` in model.ts): links say "Open" unless known to be an
  article; Watch / Get app / Open repo / Open docs / View image / Open PDF / Open note.
- `src/ui/ZoomPan.tsx`: UI-thread pinch, pan + fling, double-tap zoom. PDF reader uses it for
  the whole document (pages mounted ±3, sharper re-render of on-screen pages when zoomed,
  `hiResWidth`). New image viewer `/image/[id]` (`ZoomableImage`); reader images zoom too.

## Done 2026-11-14 (later, on device via Metro :8082, dev build rebuilt)
- PDF reader is now pdf.js in a WebView (`react-native-webview`), bundled offline:
  `src/features/pdf/viewer/template.html` → `npm run pdf-viewer` → `assets/pdf/viewer.html`
  (metro assetExts += html). Vector-sharp at any zoom (visible region re-rendered at zoom),
  native pinch/scroll, text layer: select → Copy / Highlight / Share. Highlights save to
  `highlights` with page and are painted on reopen. Scanned PDFs have no text to select.
  `react-native-pdf` / `react-native-blob-util` and their plugins removed.
- Capture success: "View item" is the filled primary, "Undo save" a text button; View item
  replaces the capture screen after the sheet closes (it used to be popped by the sheet's back()).
- Home: collections are one row of compact pills (+ new), no section header.
- Reader: `src/features/reader/cleanup.ts` drops byline/date/"Story by"/share scraps and empty
  headings, converts stray HTML, takes the writer from "Story by"; related sections with
  sub-heading items parse; author name/bio echoes go; related links are a grouped list of rows.

## Done 2026-11-14 (evening)
- Crash fix: Feeds FlashList asked getItemType/keyExtractor about a removed index (`r.k` of
  undefined) on fast taps; guarded. Repeat taps on one surface fire once (usePressMorph,
  350 ms); router.push/navigate ignore a second push within 600 ms (`src/lib/navGuard.ts`).
  Root `ErrorBoundary` = `src/ui/CrashScreen.tsx` (Try again / Go home).
- Reader: aggregator (HN) teasers never show as the article; "By Name" / "3 hours ago" lines
  at the top are dropped (name kept as byline); Written by is one card (no pill in a pill).
- Saved feed articles open in the reader (`feedItemIdForBookmark`), item button says Read.
- Onboarding: `/welcome` (2 pages) on first launch, then `HomeTour` (3 tips) on Home.
  Flags `onboarded` / `tourDone` in settings.

## Done 2026-11-14 (roadmap 1, 2, 4)
- Home "Continue reading" row (`readingQueue` in model.ts, `src/features/feed/ReadingQueue.tsx`):
  part-read PDFs with progress, then unread PDFs / Feeds articles / Markdown / docs.
- Item highlights: tap a PDF highlight → `/pdf/[id]?page=N`; share icon exports Markdown
  (`highlightsMarkdown`). Highlight cards say "Page N" for PDFs.
- Capture: "You saved this on Nov 2 · Open" banner while typing a known link; saving it again
  says "Already in your stash" and hides Undo (Undo used to delete the original item).
- Settings → Check saved links (`/links-check`, `src/features/links/check.ts`): user-started,
  4 at a time, lists Not loading / Couldn't check with Open, Archive, Delete.

## Done 2026-11-14 (night, branch feat/m3e-overhaul)
- M3 Expressive overhaul per `docs/m3-expressive.md`: M3 30-style type scale (+ editorial
  "Stash"), collapsing large app bars (`ScreenHeader` + `CollapsedAppBar`), floating nav
  connected to the + FAB (round outer ends, 8dp facing ends, label on active tab only),
  FAB menu (Link / Note / File or PDF / Images), segmented lists (`src/ui/List.tsx`: feeds,
  search, smart views, action sheets), item page floating toolbar + extended FAB, wavy
  progress with stop dot, cookie→circle source avatars.
- Colors: default palette = TonalSpot (2021) from seed #79D0FD, matched to the user's
  reference screenshots (neutral blue-gray surfaces, sky-blue primary). A vivid Vibrant
  palette was tried and rejected.

## Done 2026-11-15 (not on device yet)
- Note editor: plain controlled input (live tint removed: restyled children made Android
  replace the text each keystroke, breaking IME composition → "olleH"). Toolbar actions go
  through `applyFormat` + `useCaretAfterEdit` (`src/features/notes/format.ts`), caret lands
  inside the markers. Capture note toolbar uses the same. Editor scroll persists taps.
- Keyboard: item page scroll, editor preview and every `SheetScrollView` use
  `keyboardShouldPersistTaps="handled"`, so a tap acts at once instead of only hiding it.
- Capture link mode: outlined link field (bodyLarge, Paste/Clear), titleLarge title; note
  title titleLarge. Home carousel decor is the pill only. Tour no longer claims PDF text search.
- Updates: `src/features/updates/updates.ts` reads GitHub Releases (latest tag + .apk asset).
  Settings → About: version + build, Check for updates (opens the APK to install), release
  history; Home checks at most daily (release builds only). Credits & licenses section.
  `npm run version:bump [patch|minor|major|x.y.z]` bumps app.json version/versionCode + package.json.
- Sheet lifts above the keyboard with layout (`bottom`), not a transform: a transformed sheet
  made a second tap on a focused field drop the keyboard (reproduced + fixed on the vivo).
  Every sheet closes on a drag down (persistent ones still ignore scrim taps).
- Capture: Quote tab (text + optional who/link → a highlight with no item, tags, no
  collection); tapping Save with something missing shows an inline reason above the button.

## Done 2026-11-20 (needs a native rebuild; not on device yet)
- In-app updates: `installRelease` downloads the APK in the app (`downloadUpdate` in
  modules/expressive, progress events, cache/updates) and opens the installer through a
  FileProvider; asks for "Install unknown apps" first if needed. `useUpdate` store shared by
  Settings (wavy progress) and the Home "Update" snackbar.
- App lock (Settings → Privacy): `expo-local-authentication` prompt with device PIN fallback,
  `LockScreen` overlay at the root, lock after Right away / 1 min / 5 min away. File and photo
  pickers go through `keepUnlocked()` so they don't lock. An app-own passcode is for later.
- Save to Stash (text selection) fixed: apps start PROCESS_TEXT for a result, which put
  MainActivity in the caller's task and expo-share-intent relaunched it, losing the text.
  Now `ProcessTextActivity` (module manifest) forwards `app.stash.action.SAVE_TEXT` to
  MainActivity; `withProcessText` only strips the old filter. CaptureListener waits for the
  router before pushing /capture.

## Done 2026-11-20 (v1.0.9, widget not checked on device yet)
- "Save to Stash" home-screen widget (`modules/expressive`: `StashWidget.kt`, `res/layout/stash_widget.xml`):
  RemoteViews pill bar, Paste link pill / Note circle / File square → `stash://capture?paste=1|mode=note|mode=file`.
  Wallpaper colors on Android 12+ (`values*-v31`), M3 baseline below. `/capture` reads `paste=1`
  and fills the link from the clipboard after 350 ms (Android needs window focus).

## Done 2026-11-21 (needs a native rebuild; not on device yet)
- Widget Paste link saves at once: `QuickSaveActivity` (invisible, reads the clipboard once
  focused) queues the link in SharedPreferences + toast; `CaptureListener` drains it through
  `saveDraft` on start/resume or the `onQuickSave` event. Note/File still open /capture.
- Launcher shortcuts (`plugins/withShortcuts.js`): Paste link / New note / Upload file.
- Tab swipe shows the neighbouring tab while dragging: `detachInactiveScreens={false}`, per-tab
  peek value in `tabTransition.ts` overrides the fade-through during a swipe, `endTabSwipe` on
  `transitionEnd`. Watch memory/perf on a release build (all four tabs stay attached).
- Collection pages: sort pill (Recent / Name / Size / Unread first), shared `ui/SortButton`.
- `useSharedSelection` no longer reads a shared value during render.
- Release hygiene: `devWarn` (src/lib/log.ts) replaces console.warn; dev routes redirect Home in
  release (`devOnly`); backup import keeps only http(s) URLs and own file paths; delete/share
  only touch files/ and thumbs/ (`isOwnFile`); update downloads only from GitHub over HTTPS and
  the APK must be Stash's package.
- Open security items: no FLAG_SECURE with app lock (Recents shows content); pdf.js 3.11 with
  universal file access in the WebView; release signing silently falls back to the debug key.

## Done 2026-11-21 (v1.0.11)
- Tab swipe perf fix: with `detachInactiveScreens={false}` react-native-screens hid inactive tabs
  with `display: none`, re-laying out whole tabs on every tab change (laggy app, dropped nav-bar
  taps). `src/motion/TabScreen.tsx` (via `ScreenContext` in the tabs layout) keeps inactive tabs
  laid out, transparent and touch-less. Navigator props, tab transitions and the TabSwipe pan
  config are now stable between renders.

## Next
Roadmap (in order, tracked at https://claude.ai/artifact/AimQzdGP6PGHB7FMd3RHHo): read-later queue
on Home · highlights per item (jump to page, export) · search inside PDFs · duplicate warning +
dead-link cleanup · home-screen widget · OCR for scanned PDFs.
Start with `docs/next-session.md` (collapsible/real HN discussion, Markdown tables/code/HTML).
1. On-device feel check of motion (phase 9) and a first open of a real PDF in the reader.
2. Phone check of PDF zoom/pan and the image viewer. Remove unused `react-native-pdf` / `react-native-blob-util`
   (+ their config plugins in app.json) at the next native rebuild.
Known: dev-only `isFocused()` warning from a library; extractor keeps some page chrome
(dates, "Story by"); test data on phone (Hacker News feed, 2 saved articles, 1 hidden article).
- User asked (2026-11-14): skip per-screen phone testing; rely on tsc/lint/jest.

## Done 2026-11-21 (v1.0.12, not on device yet)
- In-app update install: the downloaded APK goes into a PackageInstaller session
  (`UpdateInstaller.kt`, result receiver → `onUpdateStatus`), so Android shows only its
  confirm sheet over Stash; no-prompt updates on Android 12+ once Stash is the installer.
  Falls back to the system installer (ACTION_VIEW) when a ROM blocks sessions (check on the
  vivo). No more GitHub fallback except iOS/Expo Go; failures and cancels show in Settings.

## Done 2026-11-25 (v1.1.0)
- Multi-select (`src/features/select/`): long press a card (300 ms) on Home, Library or a
  collection page; taps toggle while selecting. `SelectionBar` (portal: count + Select all on
  top, floating toolbar + More below) with `ItemSelection` (edit, share, move, tag, favorite,
  read state, archive, remove from collection, delete all with confirm) and
  `CollectionSelection` (edit, share, merge, delete). Back / leaving the screen ends it.
  Repo: `setRead`, `setFavorite`, `deleteHighlights`, `deleteFolders`, `mergeFolders`.
- New collection sheet: Enter only hides the keyboard; Create closes the sheet fully before
  opening the collection (it used to push over the still-open sheet). FAB menu has Collection;
  Library header + removed.
- Motion: staggered list entrances (`enterRiseAt`), selected cards sink to 0.94, count roll.
- Low-strain builds: `nice -n 19 ionice -c3 ./gradlew … --max-workers=2 -Dorg.gradle.parallel=false`
  (+ `-PreactNativeArchitectures=arm64-v8a` for vivo debug builds).

## Done 2026-11-26 (v1.2.1)
- Splash: the new loop mark at 150dp (`splash-icon*.png` cut from the adaptive foreground;
  the SVGs in `assets/icon-src` are still the old mark), cream on dark #161311 at night, fades
  out over 300 ms (`SplashScreen.setOptions`).
- Scrolling down hides only the nav bar; the FAB stays and grows into an 80dp medium FAB.
- Tabs have no headline: `TopRow` (Home: tinted loop mark + "Stash" + counts, settings) and
  `StatusScrim` replace `ScreenHeader`/`CollapsedAppBar`. Search fields are 64dp.
- Feeds: M3E pull to refresh (`src/ui/PullToRefresh.tsx`, determinate circle→soft burst while
  pulling, contained LoadingIndicator while refreshing); "+" leads the source rail, ⋮ sits
  beside New/All/Saved; article rows rounder (28/12 corners) and roomier.

## How to run (low-spec laptop: never start an emulator)
- Phone: vivo USB (adb). `adb reverse tcp:8081 tcp:8081` after any reconnect.
- Metro: `eval "$(fnm env)"; fnm exec --using=26 npx expo start --dev-client`.
- Launch: `adb shell am start -a android.intent.action.VIEW -d "stash://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`.
- Checks: `npx tsc --noEmit`, `npx expo lint`, `npx jest` (all via `fnm exec --using=26`).
- adb input injection is flaky on this phone; use deep links (`stash://dev/tab?to=feeds`,
  `stash://article/<id>`, `stash://collection/new`) and screenshots. Keep testing light.
- Haptics only on save / cancel / delete. No hex colors in screens. No puffy/heart shapes.
