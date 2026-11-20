import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import Animated from "react-native-reanimated";

import { useDbQuery } from "@/db/hooks";
import {
  createBookmark,
  createHighlight,
  createFolder,
  deleteBookmarks,
  deleteHighlight,
  findDuplicate,
  listTags,
} from "@/db/repo";
import {
  type CaptureDraft,
  extractUrl,
  hostOf,
  typeForFile,
} from "@/features/capture/normalize";
import { saveDraft } from "@/features/capture/save";
import { applyFormat, type MdFormat, useCaretAfterEdit } from "@/features/notes/format";
import { CollectionPicker, TagPicker } from "@/features/detail/Pickers";
import { folderSeed, glyphFor, hostSeed } from "@/features/stash/model";
import { useCollections } from "@/features/stash/queries";
import { useSuggestions } from "@/features/suggest/useSuggestions";
import { savedOn } from "@/lib/format";
import { haptic } from "@/motion/haptics";
import { enterFade, enterRise, exitFade, reflow } from "@/motion/layout";
import { MorphingShape } from "@/shapes/MorphingShape";
import { useCapture } from "@/state/capture";
import { useAppTheme } from "@/theme/AppTheme";
import { collectionTones, withAlpha } from "@/theme/palette";
import { FONT_FAMILY, MONO_FAMILY, Type } from "@/theme/type";
import { Button } from "@/ui/Button";
import { ButtonGroup } from "@/ui/ButtonGroup";
import { Chip } from "@/ui/Chip";
import { Ico } from "@/ui/Ico";
import { IconButton } from "@/ui/IconButton";
import { PressableSurface } from "@/ui/PressableSurface";
import { SegmentedTabs } from "@/ui/SegmentedTabs";
import { Sheet } from "@/ui/Sheet";
import { SplitButton } from "@/ui/SplitButton";
import { Text } from "@/ui/Text";
import { keepUnlocked } from '@/features/lock/lock';

type Mode = "link" | "note" | "quote" | "file";
const MODES: { key: Mode; label: string }[] = [
  { key: "link", label: "Link" },
  { key: "note", label: "Note" },
  { key: "quote", label: "Quote" },
  { key: "file", label: "File" },
];
const SAVE_LABEL: Record<Mode, string> = {
  link: "Save link",
  note: "Save note",
  quote: "Save quote",
  file: "Upload",
};
const SAVED_HINT: Record<Mode, string> = {
  link: "Preview and reader copy are being prepared.",
  note: "Your Markdown note is ready to edit anytime.",
  quote: "Find it under Quotes on Home and in Library.",
  file: "Saved to your device, ready to open offline.",
};

type Saved = {
  mode: Mode;
  folderId: string | null;
  /** Items this save created (Undo deletes them). A link saved before is not among them. */
  bookmarkIds: string[];
  highlightIds: string[];
  viewId?: string;
  /** The link was already in the stash, saved at this time. */
  alreadySavedAt?: Date;
};

/**
 * Quick-save sheet (design: Capture). Opened by the + button, a share from another app, or
 * "Save to Stash" on selected text. Link / Note / File tabs, suggested tags, a collection
 * picker and a split Save button; then a success state with Undo.
 */
export default function CaptureScreen() {
  const params = useLocalSearchParams<{ folderId?: string; mode?: Mode }>();
  const drafts = useCapture((s) => s.drafts);
  const clearDrafts = useCapture((s) => s.clear);
  const incoming = drafts[0];
  const highlightDraft = incoming?.kind === "highlight" ? incoming : null;

  const [mode, setMode] = useState<Mode>(() =>
    !incoming && (params.mode === "note" || params.mode === "quote" || params.mode === "file")
      ? params.mode
      : !incoming || incoming.kind === "highlight"
      ? "link"
      : incoming.type === "link"
        ? "link"
        : incoming.type === "text"
          ? "note"
          : "file",
  );
  const [url, setUrl] = useState(
    incoming?.kind === "bookmark" ? (incoming.url ?? "") : "",
  );
  const [title, setTitle] = useState(
    incoming?.kind === "bookmark" && incoming.type === "link"
      ? incoming.title
      : "",
  );
  const [noteTitle, setNoteTitle] = useState(
    incoming?.kind === "bookmark" && incoming.type === "text"
      ? incoming.title
      : "",
  );
  const [noteBody, setNoteBody] = useState(
    incoming?.kind === "bookmark" && incoming.type === "text"
      ? (incoming.content ?? "")
      : "",
  );
  const [quoteText, setQuoteText] = useState("");
  const [quoteSource, setQuoteSource] = useState("");
  const [files, setFiles] = useState<CaptureDraft[]>(() =>
    drafts.filter((d) => d.kind === "bookmark" && !!d.file),
  );
  const [folderId, setFolderId] = useState<string | null>(
    params.folderId || null,
  );
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [picker, setPicker] = useState<"tags" | "folder" | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);

  // "View item": the sheet closes first, then this screen is replaced by the item (pushing
  // before the sheet's own back() would let that back() pop the item again).
  const viewAfterClose = useRef<string | null>(null);
  const dismiss = () => {
    clearDrafts();
    const next = viewAfterClose.current;
    if (next) router.replace(next as Href);
    else router.back();
  };

  return (
    <>
      <Sheet accessibilityLabel="Save to Stash" onDismiss={dismiss} persistent>
        {(close) =>
          saved ? (
            <SavedView
              saved={saved}
              onUndo={async () => {
                haptic.cancel();
                await deleteBookmarks(saved.bookmarkIds);
                for (const id of saved.highlightIds) await deleteHighlight(id);
                setSaved(null);
              }}
              onView={() => {
                if (saved.viewId)
                  viewAfterClose.current =
                    saved.mode === "note"
                      ? `/note/${saved.viewId}`
                      : saved.mode === "quote"
                        ? `/highlight/${saved.viewId}`
                        : `/item/${saved.viewId}`;
                close();
              }}
            />
          ) : (
            <CaptureForm
              {...{
                mode,
                setMode,
                url,
                setUrl,
                title,
                setTitle,
                noteTitle,
                setNoteTitle,
                noteBody,
                setNoteBody,
                quoteText,
                setQuoteText,
                quoteSource,
                setQuoteSource,
              }}
              {...{
                files,
                setFiles,
                folderId,
                setFolderId,
                tagIds,
                setTagIds,
                highlightDraft,
                busy,
              }}
              onPicker={setPicker}
              onCancel={() => {
                haptic.cancel();
                close();
              }}
              onSave={async () => {
                setBusy(true);
                try {
                  const result = await save({
                    mode,
                    url,
                    title,
                    noteTitle,
                    noteBody,
                    quoteText,
                    quoteSource,
                    files,
                    folderId,
                    tagIds,
                    highlightDraft,
                  });
                  haptic.save();
                  clearDrafts();
                  setSaved(result);
                } finally {
                  setBusy(false);
                }
              }}
            />
          )
        }
      </Sheet>
      {picker === "folder" && (
        <CollectionPicker
          current={folderId}
          onPick={setFolderId}
          onDismiss={() => setPicker(null)}
        />
      )}
      {picker === "tags" && (
        <TagPicker
          selected={tagIds}
          onChange={setTagIds}
          onDismiss={() => setPicker(null)}
        />
      )}
    </>
  );
}

type SaveInput = {
  mode: Mode;
  url: string;
  title: string;
  noteTitle: string;
  noteBody: string;
  quoteText: string;
  quoteSource: string;
  files: CaptureDraft[];
  folderId: string | null;
  tagIds: string[];
  highlightDraft: Extract<CaptureDraft, { kind: "highlight" }> | null;
};

async function save(i: SaveInput): Promise<Saved> {
  const opts = { folderId: i.folderId, tagIds: i.tagIds };
  const out: Saved = {
    mode: i.mode,
    folderId: i.folderId,
    bookmarkIds: [],
    highlightIds: [],
  };
  if (i.highlightDraft) {
    const r = await saveDraft(i.highlightDraft, opts);
    out.highlightIds.push(r.id);
    return out;
  }
  if (i.mode === "link") {
    const link = extractUrl(i.url) ?? i.url.trim();
    const r = await saveDraft(
      {
        kind: "bookmark",
        type: "link",
        url: link,
        title: i.title.trim() || hostOf(link),
      },
      opts,
    );
    // A link saved before is reused, not created: Undo must never delete it.
    if (r.duplicate) out.alreadySavedAt = r.savedAt;
    else out.bookmarkIds.push(r.id);
    out.viewId = r.id;
  } else if (i.mode === "quote") {
    // A quote is a highlight with no item behind it; the source is a link or a name.
    const src = i.quoteSource.trim();
    const link = src ? extractUrl(src) : null;
    const id = await createHighlight({
      text: i.quoteText.trim(),
      ...(link ? { sourceUrl: link } : src ? { sourceTitle: src } : {}),
      tagIds: i.tagIds,
    });
    out.highlightIds.push(id);
    out.viewId = id;
  } else if (i.mode === "note") {
    const id = await createBookmark({
      type: "text",
      title: i.noteTitle.trim() || "Untitled note",
      content: i.noteBody,
      folderId: i.folderId,
      fetchStatus: "done",
      tagIds: i.tagIds,
    });
    out.bookmarkIds.push(id);
    out.viewId = id;
  } else {
    for (const f of i.files) {
      const r = await saveDraft(f, opts);
      out.bookmarkIds.push(r.id);
      out.viewId = r.id;
    }
  }
  return out;
}

type FormProps = Omit<SaveInput, "mode"> & {
  mode: Mode;
  setMode: (m: Mode) => void;
  setUrl: (s: string) => void;
  setTitle: (s: string) => void;
  setNoteTitle: (s: string) => void;
  setNoteBody: (s: string) => void;
  setQuoteText: (s: string) => void;
  setQuoteSource: (s: string) => void;
  setFiles: (f: CaptureDraft[]) => void;
  setFolderId: (id: string | null) => void;
  setTagIds: (ids: string[]) => void;
  busy: boolean;
  onPicker: (p: "tags" | "folder") => void;
  onCancel: () => void;
  onSave: () => void;
};

/** Why Save can't run yet, in words for the user; null when it can. */
function missing(p: FormProps): string | null {
  if (p.highlightDraft) return null;
  switch (p.mode) {
    case "link":
      if (!p.url.trim()) return "Paste or type a link to save it.";
      return extractUrl(p.url) || /^\S+\.\S+$/.test(p.url.trim())
        ? null
        : "That doesn't look like a link. Try something like example.com.";
    case "note":
      return p.noteTitle.trim() || p.noteBody.trim()
        ? null
        : "Give the note a title or write something first.";
    case "quote":
      return p.quoteText.trim() ? null : "Type or paste the quote first.";
    case "file":
      return p.files.length ? null : "Pick a file, PDF or image first.";
  }
}

function CaptureForm(p: FormProps) {
  const { colors } = useAppTheme();
  const reason = missing(p);
  // The hint shows once Save was tried, and goes away as soon as the form is complete.
  const [tried, setTried] = useState(false);
  const showReason = tried && !!reason;

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 8,
        }}
      >
        <Text variant="headlineSmallEmphasized" accessibilityRole="header">
          {p.highlightDraft ? "Save highlight" : "Save to Stash"}
        </Text>
        <Button
          label="Cancel"
          variant="outlined"
          size="s"
          height={44}
          onPress={p.onCancel}
        />
      </View>

      {p.highlightDraft ? (
        <View
          style={{
            marginTop: 12,
            borderRadius: 24,
            padding: 16,
            backgroundColor: colors.tertiaryContainer,
          }}
        >
          <Ico
            name="formatQuote"
            size={24}
            color={colors.onTertiaryContainer}
          />
          <Text
            variant="quote"
            color="onTertiaryContainer"
            numberOfLines={6}
            style={{ marginTop: 4 }}
          >
            {p.highlightDraft.text}
          </Text>
        </View>
      ) : (
        <>
          <View style={{ marginTop: 12 }}>
            <SegmentedTabs
              items={MODES}
              value={p.mode}
              onChange={(m) => {
                setTried(false);
                p.setMode(m);
              }}
              accessibilityLabel="What to save"
              track={colors.surface}
            />
          </View>
          <Animated.View
            key={p.mode}
            entering={enterFade}
            exiting={exitFade}
            layout={reflow}
          >
            {p.mode === "link" && <LinkFields {...p} />}
            {p.mode === "note" && <NoteFields {...p} />}
            {p.mode === "quote" && <QuoteFields {...p} />}
            {p.mode === "file" && <FileFields {...p} />}
          </Animated.View>
        </>
      )}

      {(p.mode === "link" || p.mode === "quote" || p.highlightDraft) && (
        <TagRow {...p} />
      )}
      {/* Quotes live with highlights, which have tags but no collection. */}
      {p.mode !== "quote" && !p.highlightDraft && (
        <CollectionRow
          folderId={p.folderId}
          setFolderId={p.setFolderId}
          onMore={() => p.onPicker("folder")}
        />
      )}

      {showReason && (
        <Animated.View
          entering={enterFade}
          exiting={exitFade}
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 20,
            backgroundColor: colors.errorContainer,
          }}
        >
          <Ico name="info" size={20} color={colors.onErrorContainer} />
          <Text variant="bodyMedium" color={colors.onErrorContainer} style={{ flex: 1 }}>
            {reason}
          </Text>
        </Animated.View>
      )}

      <Animated.View layout={reflow} style={{ marginTop: showReason ? 12 : 22 }}>
        {p.mode === "quote" && !p.highlightDraft ? (
          <Button
            label={p.busy ? "Saving…" : SAVE_LABEL.quote}
            icon="bookmarkAdd"
            height={56}
            onPress={() => {
              if (p.busy) return;
              if (reason) setTried(true);
              else p.onSave();
            }}
          />
        ) : (
          <SplitButton
            label={
              p.busy
                ? "Saving…"
                : p.highlightDraft
                  ? "Save highlight"
                  : SAVE_LABEL[p.mode]
            }
            icon="bookmarkAdd"
            onPress={() => {
              if (p.busy) return;
              if (reason) setTried(true);
              else p.onSave();
            }}
            onMenu={() => p.onPicker("folder")}
            menuLabel="Choose another collection"
          />
        )}
      </Animated.View>
    </View>
  );
}

function inputStyle(color: string) {
  return { color, fontFamily: FONT_FAMILY, padding: 0 } as const;
}

/** The item this link was already saved as (looked up as you type, debounced). */
function useAlreadySaved(link: string) {
  const [dup, setDup] = useState<{ id: string; createdAt: Date } | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      if (!/^https?:\/\/\S+\.\S+/i.test(link)) return void (live && setDup(null));
      void findDuplicate(link).then((d) => live && setDup(d ? { id: d.id, createdAt: d.createdAt } : null));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [link]);
  return dup;
}

function LinkFields(p: FormProps) {
  const { colors, dark } = useAppTheme();
  const link = extractUrl(p.url) ?? p.url.trim();
  const dup = useAlreadySaved(link);
  const host = link ? hostOf(link) : "";
  const tone = collectionTones(hostSeed(link || "link"), dark);
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      {/* The link gets a real field: an outlined pill with its own icon and a Paste action. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          minHeight: 56,
          paddingLeft: 16,
          paddingRight: 4,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: colors.outline,
        }}
      >
        <Ico name="link" size={22} color={colors.onSurfaceVariant} />
        <TextInput
          value={p.url}
          onChangeText={p.setUrl}
          placeholder="Paste or type a link"
          placeholderTextColor={colors.onSurfaceVariant}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="Link"
          style={[
            inputStyle(colors.onSurface),
            Type.bodyLarge,
            { flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 8 },
          ]}
        />
        {p.url ? (
          <IconButton
            icon="close"
            accessibilityLabel="Clear link"
            size={48}
            onPress={() => p.setUrl("")}
          />
        ) : (
          <IconButton
            icon="contentPaste"
            accessibilityLabel="Paste link"
            size={48}
            onPress={() =>
              void Clipboard.getStringAsync().then((t) => t.trim() && p.setUrl(t.trim()))
            }
          />
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          padding: 12,
          borderRadius: 24,
          backgroundColor: colors.surfaceContainerHigh,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tone.container,
          }}
        >
          <Text variant="headlineSmallEmphasized" color={tone.onContainer}>
            {host
              ? glyphFor({
                  url: link,
                  siteName: null,
                  type: "link",
                  title: host,
                })
              : "+"}
          </Text>
        </View>
        <TextInput
          value={p.title}
          onChangeText={p.setTitle}
          placeholder={host || "Title"}
          placeholderTextColor={withAlpha(colors.onSurface, 0.5)}
          accessibilityLabel="Title"
          style={[
            inputStyle(colors.onSurface),
            Type.titleLargeEmphasized,
            { flex: 1, minWidth: 0, minHeight: 48 },
          ]}
        />
      </View>
      {dup && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingLeft: 16,
            paddingRight: 6,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: colors.tertiaryContainer,
          }}
          accessibilityLiveRegion="polite"
        >
          <Ico name="info" size={20} color={colors.onTertiaryContainer} />
          <Text variant="bodyMedium" color={colors.onTertiaryContainer} style={{ flex: 1 }}>
            {`You saved this ${savedOn(dup.createdAt)}.`}
          </Text>
          <Button
            label="Open"
            variant="text"
            size="s"
            onPress={() => router.replace(`/item/${dup.id}`)}
          />
        </View>
      )}
    </View>
  );
}

const TOOLBAR: {
  label: string;
  icon?: "checklist" | "code";
  text?: string;
  format: MdFormat;
}[] = [
  { label: "Bold", text: "B", format: { wrap: ["**", "**"] } },
  { label: "Italic", text: "I", format: { wrap: ["_", "_"] } },
  { label: "Heading", text: "H", format: { line: "## " } },
  { label: "Checklist", icon: "checklist", format: { line: "- [ ] " } },
  { label: "Code", icon: "code", format: { wrap: ["`", "`"] } },
];

function QuoteFields(p: FormProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      <View
        style={{
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          backgroundColor: colors.tertiaryContainer,
        }}
      >
        <Ico name="formatQuote" size={24} color={colors.onTertiaryContainer} />
        <TextInput
          value={p.quoteText}
          onChangeText={p.setQuoteText}
          multiline
          autoFocus
          placeholder="Type or paste the quote"
          placeholderTextColor={withAlpha(colors.onTertiaryContainer, 0.6)}
          accessibilityLabel="Quote"
          style={[
            inputStyle(colors.onTertiaryContainer),
            Type.titleLarge,
            { minHeight: 96, maxHeight: 200, marginTop: 4, textAlignVertical: "top" },
          ]}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 56,
          paddingHorizontal: 16,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: colors.outline,
        }}
      >
        <Ico name="person" size={22} color={colors.onSurfaceVariant} />
        <TextInput
          value={p.quoteSource}
          onChangeText={p.setQuoteSource}
          placeholder="Who said it, or a link (optional)"
          placeholderTextColor={colors.onSurfaceVariant}
          autoCorrect={false}
          accessibilityLabel="Quote source"
          style={[
            inputStyle(colors.onSurface),
            Type.bodyLarge,
            { flex: 1, minWidth: 0, paddingVertical: 14 },
          ]}
        />
      </View>
    </View>
  );
}

function NoteFields(p: FormProps) {
  const { colors } = useAppTheme();
  const body = useRef<ComponentRef<typeof TextInput>>(null);
  const sel = useRef({ start: p.noteBody.length, end: p.noteBody.length });
  const placeCaret = useCaretAfterEdit(body, p.noteBody);
  const insert = (format: MdFormat) => {
    const next = applyFormat(p.noteBody, sel.current, format);
    sel.current = next.selection;
    placeCaret(next.selection);
    p.setNoteBody(next.text);
    body.current?.focus();
  };
  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: colors.surfaceContainerHigh,
        }}
      >
        <TextInput
          value={p.noteTitle}
          onChangeText={p.setNoteTitle}
          placeholder="Title"
          placeholderTextColor={colors.onSurfaceVariant}
          accessibilityLabel="Note title"
          style={[
            inputStyle(colors.onSurface),
            Type.titleLargeEmphasized,
            {
              minHeight: 56,
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 4,
            },
          ]}
        />
        <TextInput
          ref={body}
          value={p.noteBody}
          onChangeText={p.setNoteBody}
          onSelectionChange={(e) => (sel.current = e.nativeEvent.selection)}
          multiline
          placeholder="Write in Markdown…"
          placeholderTextColor={colors.onSurfaceVariant}
          accessibilityLabel="Note body, Markdown"
          style={[
            inputStyle(colors.onSurface),
            {
              fontFamily: MONO_FAMILY,
              fontSize: 13.5,
              lineHeight: 21,
              minHeight: 105,
              maxHeight: 180,
              paddingHorizontal: 16,
              paddingTop: 8,
              textAlignVertical: "top",
            },
          ]}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderTopWidth: 1,
            borderTopColor: colors.surfaceContainerHighest,
          }}
        >
          {TOOLBAR.map((t) => (
            <PressableSurface
              key={t.label}
              kind="button"
              corner={12}
              onPress={() => insert(t.format)}
              accessibilityLabel={t.label}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {t.icon ? (
                <Ico name={t.icon} size={20} color={colors.onSurface} />
              ) : (
                <Text
                  variant="labelLargeEmphasized"
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    fontStyle: t.text === "I" ? "italic" : "normal",
                  }}
                >
                  {t.text}
                </Text>
              )}
            </PressableSurface>
          ))}
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: 8,
          marginHorizontal: 8,
        }}
      >
        <Ico name="markdown" size={16} color={colors.onSurfaceVariant} />
        <Text variant="labelMedium" color="onSurfaceVariant">
          Markdown supported
        </Text>
      </View>
    </View>
  );
}

function FileFields(p: FormProps) {
  const { colors } = useAppTheme();
  const pick = async () => {
    const res = await keepUnlocked(() => DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*", "text/*", "*/*"],
      multiple: true,
      copyToCacheDirectory: true,
    }));
    if (res.canceled) return;
    const picked: CaptureDraft[] = res.assets.map((a) => {
      const file = {
        path: a.uri,
        fileName: a.name,
        mimeType: a.mimeType ?? null,
        size: a.size ?? null,
      };
      return {
        kind: "bookmark",
        type: typeForFile(file),
        title: a.name.replace(/\.[a-z0-9]+$/i, ""),
        file,
      };
    });
    p.setFiles([...p.files, ...picked]);
  };
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      <PressableSurface
        corner={24}
        onPress={() => void pick()}
        accessibilityLabel="Choose a PDF or file"
        style={{
          height: 132,
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: colors.outline,
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.secondaryContainer,
          }}
        >
          <Ico
            name="uploadFile"
            size={24}
            color={colors.onSecondaryContainer}
          />
        </View>
        <Text variant="labelLargeEmphasized">Choose a PDF or file</Text>
        <Text variant="labelMedium" color="onSurfaceVariant">
          PDF, images, text, any file
        </Text>
      </PressableSurface>
      {p.files.map((f, i) =>
        f.kind === "bookmark" ? (
          <Animated.View
            key={`${f.title}-${i}`}
            entering={enterRise}
            layout={reflow}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 10,
              borderRadius: 20,
              backgroundColor: colors.surfaceContainerHighest,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.tertiaryContainer,
              }}
            >
              <Text
                variant="labelMedium"
                color="onTertiaryContainer"
                style={{ fontWeight: "800", fontSize: 11 }}
              >
                {f.type === "pdf" ? "PDF" : f.type === "image" ? "IMG" : "FILE"}
              </Text>
            </View>
            <Text variant="labelLargeEmphasized" numberOfLines={1} style={{ flex: 1 }}>
              {f.title}
            </Text>
            <IconButton
              icon="close"
              accessibilityLabel={`Remove ${f.title}`}
              size={40}
              onPress={() => p.setFiles(p.files.filter((_, j) => j !== i))}
            />
          </Animated.View>
        ) : null,
      )}
    </View>
  );
}

function TagRow(p: FormProps) {
  const { colors } = useAppTheme();
  const link = extractUrl(p.url) ?? "";
  const s = useSuggestions(
    {
      title: p.title || p.highlightDraft?.text,
      url: link || p.highlightDraft?.sourceUrl,
    },
    [],
    5,
  );
  const shown = useMemo(() => {
    const ids = new Set([...s.tags.map((t) => t.id), ...p.tagIds]);
    return [...ids];
  }, [s.tags, p.tagIds]);
  // Selected tags can come from the full picker (or be created there), not just the
  // suggestions, so resolve labels against every tag. Live, so new tags show at once.
  const { data: allTags } = useDbQuery(listTags, [], []);
  const names = useMemo(
    () => new Map([...allTags, ...s.tags].map((t) => [t.id, t.name])),
    [allTags, s.tags],
  );
  useEffect(() => {
    if (!p.folderId && s.folderId) p.setFolderId(s.folderId);
    // Only adopt the suggested collection once, when nothing was chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.folderId]);
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginHorizontal: 8,
          marginTop: 18,
          marginBottom: 8,
        }}
      >
        <Ico name="autoAwesome" size={16} color={colors.primary} />
        <Text variant="titleSmallEmphasized" color="primary">
          {shown.length ? "Suggested tags" : "Tags"}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {shown.map((id) => (
          <Chip
            key={id}
            label={`#${names.get(id) ?? ""}`}
            selected={p.tagIds.includes(id)}
            onPress={() =>
              p.setTagIds(
                p.tagIds.includes(id)
                  ? p.tagIds.filter((x) => x !== id)
                  : [...p.tagIds, id],
              )
            }
          />
        ))}
        <Chip
          label="Tag"
          icon="add"
          onPress={() => p.onPicker("tags")}
          accessibilityLabel="Add tags"
        />
      </View>
    </View>
  );
}

/** Inbox + the two most relevant collections as a connected group; "More" opens the full list. */
function CollectionRow({
  folderId,
  setFolderId,
  onMore,
}: {
  folderId: string | null;
  setFolderId: (id: string | null) => void;
  onMore: () => void;
}) {
  const { data: collections } = useCollections();
  const recent = [...collections].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
  const chosen = collections.find((c) => c.id === folderId);
  const top = [
    ...(chosen ? [chosen] : []),
    ...recent.filter((c) => c.id !== folderId),
  ].slice(0, 2);
  const items = [
    { key: "inbox", label: "Inbox" },
    ...top.map((c) => ({ key: c.id, label: c.name })),
  ];
  const { colors } = useAppTheme();
  // Naming a new collection right here, without leaving the sheet.
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const create = async () => {
    const n = name.trim();
    if (!n) return;
    const id = await createFolder({ name: n });
    setFolderId(id);
    setName("");
    setNaming(false);
  };
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginHorizontal: 8,
          marginTop: 18,
          marginBottom: 8,
        }}
      >
        <Text variant="titleSmallEmphasized" color="primary">
          Collection
        </Text>
        <View style={{ flexDirection: "row" }}>
          <Button
            label={naming ? "Cancel" : "New"}
            variant="text"
            size="xs"
            onPress={() => setNaming((v) => !v)}
          />
          {collections.length > 2 && !naming && (
            <Button label="More" variant="text" size="xs" onPress={onMore} />
          )}
        </View>
      </View>
      {naming && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder="Collection name"
            placeholderTextColor={colors.onSurfaceVariant}
            returnKeyType="done"
            onSubmitEditing={() => void create()}
            accessibilityLabel="New collection name"
            style={[
              inputStyle(colors.onSurface),
              Type.bodyLarge,
              {
                flex: 1,
                height: 48,
                borderRadius: 24,
                paddingHorizontal: 20,
                backgroundColor: colors.surfaceContainerHigh,
              },
            ]}
          />
          <Button
            label="Create"
            size="s"
            onPress={() => void create()}
          />
        </View>
      )}
      <ButtonGroup
        items={items}
        value={folderId ?? "inbox"}
        onChange={(k) => setFolderId(k === "inbox" ? null : k)}
        accessibilityLabel="Collection"
        height={44}
        selectedColors={{ bg: "primaryContainer", fg: "onPrimaryContainer" }}
      />
    </View>
  );
}

function SavedView({
  saved,
  onUndo,
  onView,
}: {
  saved: Saved;
  onUndo: () => void;
  onView: () => void;
}) {
  const { colors, dark } = useAppTheme();
  const { data: collections } = useCollections();
  const [shape, setShape] = useState<"circle" | "cookie9Sided">("circle");
  useEffect(() => {
    const t = setTimeout(() => setShape("cookie9Sided"), 60);
    return () => clearTimeout(t);
  }, []);
  const folder = collections.find((c) => c.id === saved.folderId) ?? null;
  const tone = folder ? collectionTones(folderSeed(folder), dark) : null;
  const where =
    folder?.name ?? (saved.mode === "quote" ? "Quotes" : saved.highlightIds.length ? "Highlights" : "Inbox");
  return (
    <Animated.View
      entering={enterRise}
      style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8, gap: 6 }}
    >
      <View
        style={{
          width: 96,
          height: 96,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MorphingShape
          shape={shape}
          size={96}
          color={tone?.container ?? colors.primaryContainer}
          rotation={shape === "circle" ? 0 : 20}
          fit="box"
        />
        <View style={{ position: "absolute" }}>
          <Ico
            name="check"
            size={44}
            color={tone?.onContainer ?? colors.onPrimaryContainer}
          />
        </View>
      </View>
      <Text
        variant="headlineSmallEmphasized"
        style={{ marginTop: 10, textAlign: "center" }}
      >
        {saved.alreadySavedAt ? "Already in your stash" : `Saved to ${where}`}
      </Text>
      <Text
        variant="bodyMedium"
        color="onSurfaceVariant"
        style={{ textAlign: "center" }}
      >
        {saved.alreadySavedAt
          ? `You saved this link ${savedOn(saved.alreadySavedAt)}.`
          : SAVED_HINT[saved.mode]}
      </Text>
      <View style={{ alignSelf: "stretch", gap: 4, marginTop: 18 }}>
        {saved.viewId && (
          <Button
            label="View item"
            icon="arrowForward"
            variant="filled"
            height={56}
            onPress={onView}
          />
        )}
        {saved.bookmarkIds.length + saved.highlightIds.length > 0 && (
          <Button
            label="Undo save"
            variant="text"
            size="s"
            height={48}
            onPress={onUndo}
          />
        )}
      </View>
    </Animated.View>
  );
}
