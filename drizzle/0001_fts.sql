CREATE VIRTUAL TABLE `bookmarks_fts` USING fts5(
  `title`, `description`, `content`, `note`, `url`, `site_name`,
  content='bookmarks', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `bookmarks_ai` AFTER INSERT ON `bookmarks` BEGIN
  INSERT INTO `bookmarks_fts`(rowid, title, description, content, note, url, site_name)
  VALUES (new.rowid, new.title, new.description, new.content, new.note, new.url, new.site_name);
END;
--> statement-breakpoint
CREATE TRIGGER `bookmarks_ad` AFTER DELETE ON `bookmarks` BEGIN
  INSERT INTO `bookmarks_fts`(`bookmarks_fts`, rowid, title, description, content, note, url, site_name)
  VALUES ('delete', old.rowid, old.title, old.description, old.content, old.note, old.url, old.site_name);
END;
--> statement-breakpoint
CREATE TRIGGER `bookmarks_au` AFTER UPDATE ON `bookmarks` BEGIN
  INSERT INTO `bookmarks_fts`(`bookmarks_fts`, rowid, title, description, content, note, url, site_name)
  VALUES ('delete', old.rowid, old.title, old.description, old.content, old.note, old.url, old.site_name);
  INSERT INTO `bookmarks_fts`(rowid, title, description, content, note, url, site_name)
  VALUES (new.rowid, new.title, new.description, new.content, new.note, new.url, new.site_name);
END;
--> statement-breakpoint
CREATE VIRTUAL TABLE `highlights_fts` USING fts5(
  `text`, `note`, `source_title`,
  content='highlights', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `highlights_ai` AFTER INSERT ON `highlights` BEGIN
  INSERT INTO `highlights_fts`(rowid, text, note, source_title) VALUES (new.rowid, new.text, new.note, new.source_title);
END;
--> statement-breakpoint
CREATE TRIGGER `highlights_ad` AFTER DELETE ON `highlights` BEGIN
  INSERT INTO `highlights_fts`(`highlights_fts`, rowid, text, note, source_title) VALUES ('delete', old.rowid, old.text, old.note, old.source_title);
END;
--> statement-breakpoint
CREATE TRIGGER `highlights_au` AFTER UPDATE ON `highlights` BEGIN
  INSERT INTO `highlights_fts`(`highlights_fts`, rowid, text, note, source_title) VALUES ('delete', old.rowid, old.text, old.note, old.source_title);
  INSERT INTO `highlights_fts`(rowid, text, note, source_title) VALUES (new.rowid, new.text, new.note, new.source_title);
END;
