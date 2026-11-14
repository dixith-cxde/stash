# Next session: context and tasks

Point a new session at this file. Then read `PROGRESS.md`, `AGENTS.md` (kept locally, not in
git), `docs/rebuild-plan.md` and `docs/animation.md`. Design canvas:
<https://claude.ai/artifact/ApNigGtc6hbe7MB9Mw5Bte>.

## Where things stand (2026-11-14)

- **Released:** v1.0.2 is the latest GitHub release (private repo `dixith-cxde/stash`).
  Earlier releases: v1.0.0 and v1.0.1 (new icon). `main` = `feat/stash-v1` = `cfb2304`, pushed.
- **License:** CC BY-NC-SA 4.0. **Icon:** a line-drawn face; sources in `assets/icon-src/`.
- **No Claude in the repo:** never add `Co-Authored-By: Claude` or similar to commits or PRs.
  `CLAUDE.md`, `AGENTS.md` and `.claude/` are gitignored; keep them that way.
- **Never commit** the user's `app.json` `web.output: "single"` change. Stage only your own hunks.
- Typecheck, lint and 303 jest tests pass.

### Done in v1.0.2
- Reader tables: `src/features/feeds/extract.ts` writes GFM tables. Header-only tables are
  dropped. Layout tables stay as blocks. `MarkdownView` renders them through `TableBlock`,
  with column widths from `src/features/notes/table.ts`.
- Full-text feeds: parse keeps `bodyHtml`, and sync stores `feedHtmlToMarkdown()` in
  `feed_items.article`.
- Reader format version: `READER_FORMAT = 2` (`src/features/reader/discussion.ts`). The
  reader re-extracts older cached articles once (`loadArticle(item, true)`). Bump it whenever
  extraction changes.
- Quotes (`QuoteBlock`: short = card, long = accent bar with nested blocks), inline code
  chip, code blocks that scroll sideways, raw HTML reduced to its text.
- End of article: `src/features/reader/endmatter.ts` (pure, tested) splits off related
  links, author and tags. `EndMatter.tsx` renders them as cards and chips.
- Home: copy button and long-press Copy / Share sheet (`src/features/feed/copy.ts`,
  `FeedCard.tsx`). A nested button uses `PressableSurface blockParent` so it doesn't open the card.
- Dev-only Kit screen (`stash://dev/kit`) has a "Reader article" sample for visual checks.

## Build, test, release

- Node: prefix tooling with `fnm exec --using=26` (the shell default is Node 20).
  Check: `npx tsc --noEmit`, `npx expo lint`, `npx jest`.
- **The phone (USB vivo, `adb`) runs the debug dev build**, not the release; its data lives
  there. Test JS changes through Metro: `adb reverse tcp:8081 tcp:8081`, a dev server on 8081
  (often already running), and deep links like `stash://article/<id>`. Use slow swipes
  (`input swipe … 1500`); fast ones fling. Never uninstall it (that wipes data) unless the
  user agrees.
- App DB for inspection: `adb exec-out run-as app.stash.bookmarks cat files/SQLite/stash.db`
  (also `-wal` / `-shm`).
- Release:
  1. Bump `version` and `android.versionCode` in `app.json`.
  2. Run `CI=1 npx expo prebuild -p android --no-install`.
  3. In `android/`, run `JAVA_HOME=/usr/lib/jvm/java-21-openjdk ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a`.
  4. Check the signature with `apksigner` (cert SHA-256 `e485397a…b77a53`).
  5. Scan the APK for secrets.
  6. Tag, then `gh release create vX --latest` with `stash-vX.apk`.
- Signing: `~/.android/stash-release.jks`, with passwords in `~/.gradle/gradle.properties`
  (`STASH_UPLOAD_*`). Both must be backed up.

## Tasks, in order

1. **Discussion block** (`src/features/reader/DiscussionSection.tsx`) looks bad. For Hacker
   News, load the thread from `https://hn.algolia.com/api/v1/items/<id>`, only when the user
   opens it. Cache it (Drizzle migration), with a refresh. Show a clean threaded list:
   author, age, collapsible replies, capped indentation, virtualized. Otherwise remove the
   page-scraped comments. Either way, the block is **collapsed by default** ("Discussion ·
   N comments"): height on a spatial spring, content fade on an effects spring.
2. **Markdown leftovers:** footnotes, `<details>/<summary>` as a collapsible, `<sup>`/`<kbd>`,
   images inside links. Check the note editor and the file viewer (`src/app/file/[id].tsx`)
   with the new table, quote and code rendering.
3. **Older items:** PDF pinch zoom; Apps / Files filters on Home and Library; remove the
   unused `react-native-pdf` / `react-native-blob-util` and their config plugins (commit only
   that `app.json` hunk); on-device check of the release build (PDF reader, Feeds, motion).

## Constraints
- Low-spec laptop: no emulators, keep testing light; use the phone.
- Vibration only on save, cancel and delete. No hex colors in screens. Never the puffy or
  heart shapes. Pressables on `PressableSurface`, motion via `useSprings()`/`springTo()`.
- Use subagents for independent parallel work. Keep `PROGRESS.md` and this file current.
