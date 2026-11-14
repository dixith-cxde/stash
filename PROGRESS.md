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
  (`/collection/tag-<id>`), deep links open over Home. Not yet tried on the phone.

## Next
1. Quick phone check of Search tab, Settings controls, collection sheet (light testing only).
2. Phase 7 rest: in-app PDF reader (native `renderPdfPage` exists in modules/expressive).
3. Phase 9 motion polish, Phase 10 README/AGENTS docs.
Known: dev-only `isFocused()` warning from a library; extractor keeps some page chrome
(dates, "Story by"); test data on phone (Hacker News feed, 2 saved articles, 1 hidden article).

## How to run (low-spec laptop: never start an emulator)
- Phone: vivo USB (adb). `adb reverse tcp:8081 tcp:8081` after any reconnect.
- Metro: `eval "$(fnm env)"; fnm exec --using=26 npx expo start --dev-client`.
- Launch: `adb shell am start -a android.intent.action.VIEW -d "stash://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`.
- Checks: `npx tsc --noEmit`, `npx expo lint`, `npx jest` (all via `fnm exec --using=26`).
- adb input injection is flaky on this phone; use deep links (`stash://dev/tab?to=feeds`,
  `stash://article/<id>`, `stash://collection/new`) and screenshots. Keep testing light.
- Haptics only on save / cancel / delete. No hex colors in screens. No puffy/heart shapes.
