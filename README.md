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

## License

Stash is licensed under [CC BY-NC-SA 4.0](LICENSE) (Creative Commons
Attribution-NonCommercial-ShareAlike 4.0). You can use, fork, change and share it freely, as long
as you credit the author ([dixith-cxde](https://github.com/dixith-cxde/stash)), don't use it to
make money or run a business, and release your changed versions under the same license. For
commercial use, ask the author for a separate license.
