# Stash

Save anything from any app (links, PDFs, images, notes, and text highlights) and organize it
with nested folders, lists (manual or smart), and tags. Android-first, local-only, built with
**Material 3 Expressive**.

## Run it

Requirements: Node ≥ 22.13 (`.node-version` pins 26), JDK 17 or 21, Android SDK (API 36).
This app has custom native code, so it needs a development build; Expo Go won't work.

```bash
npm install
npm run android        # expo run:android: prebuild + build + install the dev client
npm start              # Metro for the dev client afterwards
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`.

## How it is built

| Concern | Choice |
| --- | --- |
| UI | `@expo/ui/jetpack-compose`: real Compose Material3 1.5 rendered inside `MaterialExpressiveTheme` |
| Missing M3E pieces | `modules/expressive` (local Expo module, Kotlin): connected `ButtonGroup`, `FabMenu`, `MorphingShape`, brand type scale, PDF page renderer, PROCESS_TEXT bridge |
| Color | Wallpaper dynamic color, or a seed run through `SchemeExpressive` (2025 spec) in `src/theme/palette.ts` |
| Type | Google Sans Flex (OFL), static instances with `ROND=50`, in `assets/fonts` |
| Icons | Material Symbols Rounded XML drawables in `assets/icons` (`src/theme/icons.ts`) |
| Data | expo-sqlite + Drizzle ORM; FTS5 search (`drizzle/0001_fts.sql`); `useDbQuery` re-runs on DB change |
| Capture | `expo-share-intent` (text, URLs, PDFs, images, multiple files) and the `Save to Stash` text-selection action (`plugins/withProcessText.js`) |
| Previews | OpenGraph/Twitter meta parser + YouTube oEmbed (`src/features/preview`) |
| PDFs | `react-native-pdf` reader; first-page thumbnails via Android `PdfRenderer` |

### Layout

```
src/app/            routes: (tabs)/ Home, Library, Highlights, Search · item, pdf, folder, list, tag, capture, settings
src/components/     Compose building blocks (BookmarkCollection, sheets, HighlightCard, TopBar…)
src/db/             schema, filters (SmartFilter → SQL), repo, live-query hook
src/features/       capture (normalize/save/quick add), preview, files, backup (JSON + Netscape HTML)
src/theme/          tokens, palette, icons, per-type shapes
modules/expressive/ Kotlin + TS wrappers for the custom Compose views
```

### Database changes

Edit `src/db/schema.ts`, then run `npm run db:generate`. FTS tables and triggers live in the
hand-written `drizzle/0001_fts.sql`; update it if you add searchable columns.

## Backup and import

Settings → Backup exports a full JSON backup or a Netscape bookmarks HTML file. Import accepts
either format, so bookmarks exported from Chrome, Firefox, Pocket, Raindrop or Omnivore come in
with their folders and tags.
