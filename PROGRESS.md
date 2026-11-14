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

## Next
Start with `docs/next-session.md` (collapsible/real HN discussion, Markdown tables/code/HTML).
1. On-device feel check of motion (phase 9) and a first open of a real PDF in the reader.
2. PDF pinch zoom (not built). Remove unused `react-native-pdf` / `react-native-blob-util`
   (+ their config plugins in app.json) at the next native rebuild.
Known: dev-only `isFocused()` warning from a library; extractor keeps some page chrome
(dates, "Story by"); test data on phone (Hacker News feed, 2 saved articles, 1 hidden article).
- User asked (2026-11-14): skip per-screen phone testing; rely on tsc/lint/jest.

## How to run (low-spec laptop: never start an emulator)
- Phone: vivo USB (adb). `adb reverse tcp:8081 tcp:8081` after any reconnect.
- Metro: `eval "$(fnm env)"; fnm exec --using=26 npx expo start --dev-client`.
- Launch: `adb shell am start -a android.intent.action.VIEW -d "stash://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`.
- Checks: `npx tsc --noEmit`, `npx expo lint`, `npx jest` (all via `fnm exec --using=26`).
- adb input injection is flaky on this phone; use deep links (`stash://dev/tab?to=feeds`,
  `stash://article/<id>`, `stash://collection/new`) and screenshots. Keep testing light.
- Haptics only on save / cancel / delete. No hex colors in screens. No puffy/heart shapes.
