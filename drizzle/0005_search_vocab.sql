-- Smart search: read-only views of the FTS indexes' vocabularies (term, doc count, hits),
-- used to correct typos against words that actually exist in the user's stash.
CREATE VIRTUAL TABLE `bookmarks_vocab` USING fts5vocab(`bookmarks_fts`, 'row');
--> statement-breakpoint
CREATE VIRTUAL TABLE `highlights_vocab` USING fts5vocab(`highlights_fts`, 'row');
