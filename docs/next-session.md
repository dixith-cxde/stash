# Next session: context and tasks

Paste or point a new Claude session at this file. Read `PROGRESS.md`, `AGENTS.md`,
`docs/rebuild-plan.md` and `docs/animation.md` first. Design canvas:
<https://claude.ai/artifact/ApNigGtc6hbe7MB9Mw5Bte>.

## Where things stand (2026-11-14)

- Stash v1.0.0 is released on GitHub (private repo `dixith-cxde/stash`, release `v1.0.0`,
  APK for arm64-v8a + armeabi-v7a). `main` and `feat/stash-v1` are pushed and equal.
- Release builds are signed by `plugins/withReleaseSigning.js` with the key in
  `~/.android/stash-release.jks`; its passwords live only in `~/.gradle/gradle.properties`
  (`STASH_UPLOAD_*`). Back both up: losing them means future APKs can't update installed ones.
- The release APK and the dev client share the package `app.stash.bookmarks` but not the
  signing key, so one must be uninstalled before installing the other (this wipes app data).
- My own `app.json` change (`web.output: "single"`) is never committed.
- Typecheck, lint and 275 jest tests pass.

## Tasks, in order

### 1. Discussion block in the article reader
The current comments UI (`src/features/reader/DiscussionSection.tsx`, used by
`src/app/article/[id].tsx`) looks bad. Do **one** of these, preferring the first that can be
done well:

1. **Load comments properly.** For Hacker News items, fetch the thread (the official
   Firebase API `https://hacker-news.firebaseio.com/v0/item/<id>.json`, or Algolia
   `https://hn.algolia.com/api/v1/items/<id>` which returns the whole tree in one request).
   Only when the user opens the discussion, never in the background. Cache it (new column or
   table via a Drizzle migration) with a refresh. Render a clean threaded list: author, age,
   points if any, collapsible replies, HTML comment bodies converted to our Markdown/Text.
   Keep it light on an older phone: virtualize long threads, cap depth indentation.
2. Otherwise **remove** page-scraped comments from the reader entirely.

Either way the whole Discussion block must be **collapsed by default**: a single row/card
("Discussion · 201 comments") that expands only when tapped (height on a spatial spring,
content fade on an effects spring, per `docs/animation.md`).

### 2. Markdown rendering gaps
`src/features/notes/MarkdownView.tsx` (marked lexer, our own renderer) has no `table` case
and no handling for raw `html` blocks, so they show as raw text. Fix, for both notes and the
reader (`reading` mode) and the file viewer (`src/app/file/[id].tsx`):
- **Tables**: horizontally scrollable grid, header row styled, column alignment from the
  Markdown, cell inline formatting, zebra or divider rows from color roles.
- **Code blocks**: monospace, horizontal scroll (no wrapping), language label, copy button.
- **Raw HTML blocks / inline HTML**: strip tags safely or map the common ones (`<br>`,
  `<sup>`, `<kbd>`, `<details>/<summary>` as a collapsible).
- Check nested lists, task lists, blockquotes with nested blocks, footnotes, `hr`,
  headings with inline code/links, and images inside links.
- Add jest tests for any pure helpers (alignment parsing, HTML stripping).

### 3. Still open from before
- On-device check of the PDF reader, the Feeds speed work, and motion feel (release build).
- PDF pinch zoom. Filters for the new link/file kinds (Apps, Files) on Home/Library.
- Remove unused `react-native-pdf` / `react-native-blob-util` and their config plugins
  (`app.json` edit: commit only that hunk, never the `web.output` change).

## Constraints (unchanged)
- Low-spec laptop: no emulators, keep testing light; the USB vivo phone via deep links and
  screenshots (simulated taps are unreliable). The user may ask to skip per-screen checks.
- Vibration only on save, cancel and delete. No hex colors in screens. Never the puffy or
  heart shapes. Pressables on `PressableSurface`, motion via `useSprings()`/`springTo()`.
- Use subagents for parallel work and keep `PROGRESS.md` updated.
