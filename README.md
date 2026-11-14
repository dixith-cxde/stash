# Stash

**Read & remember.** Save anything from any app (links, PDFs, images, notes, text highlights),
read it later, keep what matters, and find it again. Feeds (RSS/Atom) bring in new reading.
Android-first, local-only (no account, no cloud, no AI), built with **Material 3 Expressive**.

Tabs: **Home · Library · Feeds · Search**. Highlights live in Library's smart view.

## Run it

Requirements: Node ≥ 22.13 (`.node-version` pins 26), JDK 17 or 21, Android SDK (API 36).
The app has custom native code, so it needs a development build; Expo Go won't work.

```bash
npm install
npm run android        # expo run:android: prebuild + build + install the dev client
npm start              # Metro for the dev client afterwards
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`.

Dev deep links (handy when you can't tap): `stash://dev/tab?to=feeds`, `stash://dev/shapes`,
`stash://dev/kit`, `stash://dev/transitions`, `stash://dev/seed` (sample data; `?clear=1`
removes it), plus real routes such as `stash://settings` and `stash://collection/new`.

## How it is built

Everything on screen is plain React Native views. There is no Jetpack Compose / `@expo/ui`.

| Concern | Choice |
| --- | --- |
| UI | React Native views + Reanimated 4 + Gesture Handler 3; Skia for shape morphs |
| Motion | M3 Expressive spring tokens (`src/motion/tokens.ts`), explained in [docs/animation.md](docs/animation.md) |
| Shapes | The 35 MaterialShapes ported from `androidx.graphics.shapes` (`src/shapes/`), with morphing and the loading indicator |
| Color | Wallpaper dynamic color, or a seed run through `SchemeExpressive` (2025 spec) in `src/theme/palette.ts`; collection tones via `collectionTones()` |
| Type | Google Sans Flex (OFL) in `assets/fonts`, scale in `src/theme/type.ts` |
| Icons | Material Symbols Rounded, converted to SVG paths (`src/theme/iconPaths.ts`, `src/ui/Ico.tsx`) |
| Data | expo-sqlite + Drizzle ORM, FTS5 search; `useDbQuery` re-runs on DB change |
| Search | Home pill: instant keyword search. Search tab: local "smart" search (prefix, stemming, synonyms, typo fixes, tag/collection/site weighting) |
| Feeds | RSS/Atom with conditional GETs; refresh only when the tab opens and feeds are over 3 h old, or on pull-to-refresh. Reader mode extracts full articles |
| PDFs | In-app reader: pages rendered by Android `PdfRenderer` (`modules/expressive`), cached per width, resumes at the last page |
| Capture | `expo-share-intent` (text, URLs, PDFs, images, files) and the "Save to Stash" text-selection action (`plugins/withProcessText.js`) |
| Previews | OpenGraph/Twitter meta + YouTube oEmbed (`src/features/preview`) |

### Layout

```
src/app/            routes only: (tabs)/ Home, Library, Feeds, Search · item, note, pdf, article,
                    collection, highlight, find, capture, settings · dev/ playgrounds
src/ui/             design-system kit: Text, Ico, Button, IconButton, ButtonGroup, Chip, Sheet,
                    PressableSurface, FloatingNavBar, SearchPill, ProgressBar, Snackbar…
src/motion/         spring tokens, usePressMorph, useSelection, scroll chrome, tab fade-through,
                    transition/ (container transform, shared axis, predictive-back preview)
src/shapes/         MaterialShapes geometry, morph matching, <Shape>, <MorphingShape>, <LoadingIndicator>
src/features/       feed, collections, detail, capture, notes, feeds, search, pdf, preview,
                    suggest, backup, files
src/db/             schema, filters (smart lists → SQL), repo, live-query hook
src/theme/          palette, AppTheme (useColors), type scale, icons
modules/expressive/ native helpers only: PDF page render, PROCESS_TEXT, dynamic color
```

Plan and history of the v3 rebuild: [docs/rebuild-plan.md](docs/rebuild-plan.md).

### Database changes

Edit `src/db/schema.ts`, then run `npm run db:generate`. FTS tables and triggers live in
hand-written migrations (`drizzle/0001_fts.sql`, `0005_search_vocab.sql`); update them if you
add searchable columns.

## Backup and import

Settings → Backup exports a full JSON backup or a Netscape bookmarks HTML file. Import accepts
either format, so bookmarks exported from Chrome, Firefox, Pocket, Raindrop or Omnivore come in
with their folders and tags.

## Built with Claude

Stash was built by pairing with **Claude** (Anthropic's AI model) through **Claude Code**, mostly
in the Claude desktop app. The app itself has no AI in it; Claude was the coding partner. The
author set the direction, design taste and priorities, tested every build on a real phone, and
decided what shipped. Claude read the docs, wrote and changed the code, and ran the checks.

### How the work was run

1. **Project rules first.** [`AGENTS.md`](AGENTS.md) (loaded through `CLAUDE.md`) tells Claude
   the stack and the house rules: plain React Native views (no Compose), Reanimated springs from
   `src/motion/tokens.ts` only, `PressableSurface` for anything tappable, colors from
   `useColors()`, icons through `Ico`, data through `src/db/repo.ts`, and "read the versioned
   Expo docs, don't trust memory".
2. **Reference docs in the repo.** Claude worked from written specs instead of guesses:
   - [`docs/m3-expressive.md`](docs/m3-expressive.md): Material 3 Expressive rules with the
     AndroidX token values (corners, connected groups, carousel, toggles) and an audit of the app.
   - [`docs/animation.md`](docs/animation.md): which spring goes with which motion.
   - [`docs/rebuild-plan.md`](docs/rebuild-plan.md): the plan and history of the rebuild.
   - [`PROGRESS.md`](PROGRESS.md) and [`docs/next-session.md`](docs/next-session.md): where things
     stand, what is next, and the release steps, so each new session picks up where the last ended.
3. **Small, concrete requests.** Each round was a short request, often with screenshots of the
   app or of a reference design. Claude made the change, ran `tsc` and `expo lint`, and committed.
4. **Testing on a device.** The author ran the debug build on a USB-connected Android phone
   (no emulator: the laptop is low-spec) and sent back what looked or felt wrong.
5. **Feedback became rules.** Corrections that should stick (haptics only on save, cancel and
   delete; calm tonal colors instead of a vivid palette; no attribution lines in commits) were
   saved to Claude's memory or the project rules, so later sessions follow them.
6. **Releases.** Claude bumped the version in `app.json`, ran `expo prebuild` and the Gradle
   release build, checked the APK signature and scanned it for secrets, then tagged the version
   and published the APK as a GitHub release.

### If you want to work on it the same way

Open the repo in Claude Code, let it read `AGENTS.md`, `PROGRESS.md` and the docs above, and ask
for one change at a time. Keep `PROGRESS.md` current so the next session has the context, and
run `npm run typecheck` and `npm run lint` before you commit.

## License

Stash is licensed under [CC BY-NC-SA 4.0](LICENSE) (Creative Commons
Attribution-NonCommercial-ShareAlike 4.0). You can use, fork, change and share it freely, as long
as you credit the author ([dixith-cxde](https://github.com/dixith-cxde/stash)), don't use it to
make money or run a business, and release your changed versions under the same license. For
commercial use, ask the author for a separate license.
