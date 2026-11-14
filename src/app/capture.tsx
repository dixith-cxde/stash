import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { useDbQuery } from "@/db/hooks";
import {
  createBookmark,
  deleteBookmarks,
  deleteHighlight,
  listTags,
} from "@/db/repo";
import {
  type CaptureDraft,
  extractUrl,
  hostOf,
  typeForFile,
} from "@/features/capture/normalize";
import { saveDraft } from "@/features/capture/save";
import { CollectionPicker, TagPicker } from "@/features/detail/Pickers";
import { folderSeed, glyphFor, hostSeed } from "@/features/stash/model";
import { useCollections } from "@/features/stash/queries";
import { useSuggestions } from "@/features/suggest/useSuggestions";
import { haptic } from "@/motion/haptics";
import { enterRise, reflow } from "@/motion/layout";
import { Spring } from "@/motion/tokens";
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

type Mode = "link" | "note" | "file";
const MODES: { key: Mode; label: string }[] = [
  { key: "link", label: "Link" },
  { key: "note", label: "Note" },
  { key: "file", label: "File" },
];
const SAVE_LABEL: Record<Mode, string> = {
  link: "Save link",
  note: "Save note",
  file: "Upload",
};
const SAVED_HINT: Record<Mode, string> = {
  link: "Preview and reader copy are being prepared.",
  note: "Your Markdown note is ready to edit anytime.",
  file: "Saved to your device, ready to open offline.",
};

type Saved = {
  mode: Mode;
  folderId: string | null;
  bookmarkIds: string[];
  highlightIds: string[];
  viewId?: string;
};

/**
 * Quick-save sheet (design: Capture). Opened by the + button, a share from another app, or
 * "Save to Stash" on selected text. Link / Note / File tabs, suggested tags, a collection
 * picker and a split Save button; then a success state with Undo.
 */
export default function CaptureScreen() {
  const params = useLocalSearchParams<{ folderId?: string }>();
  const drafts = useCapture((s) => s.drafts);
  const clearDrafts = useCapture((s) => s.clear);
  const incoming = drafts[0];
  const highlightDraft = incoming?.kind === "highlight" ? incoming : null;

  const [mode, setMode] = useState<Mode>(() =>
    !incoming || incoming.kind === "highlight"
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

  const dismiss = () => {
    clearDrafts();
    router.back();
  };

  return (
    <>
      <Sheet accessibilityLabel="Save to Stash" onDismiss={dismiss}>
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
                close();
                if (saved.viewId)
                  setTimeout(
                    () =>
                      router.push(
                        saved.mode === "note"
                          ? `/note/${saved.viewId}`
                          : `/item/${saved.viewId}`,
                      ),
                    220,
                  );
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
    out.bookmarkIds.push(r.id);
    out.viewId = r.id;
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
  setFiles: (f: CaptureDraft[]) => void;
  setFolderId: (id: string | null) => void;
  setTagIds: (ids: string[]) => void;
  busy: boolean;
  onPicker: (p: "tags" | "folder") => void;
  onCancel: () => void;
  onSave: () => void;
};

function CaptureForm(p: FormProps) {
  const { colors } = useAppTheme();
  const canSave =
    !p.busy &&
    (!!p.highlightDraft ||
      (p.mode === "link" &&
        !!(
          extractUrl(p.url) ?? (/^\S+\.\S+$/.test(p.url.trim()) ? p.url : "")
        )) ||
      (p.mode === "note" && !!(p.noteTitle.trim() || p.noteBody.trim())) ||
      (p.mode === "file" && p.files.length > 0));

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
        <Text variant="headlineSmall" accessibilityRole="header">
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
              onChange={p.setMode}
              accessibilityLabel="What to save"
              track={colors.surface}
            />
          </View>
          <Animated.View
            key={p.mode}
            entering={FadeIn.springify()
              .mass(1)
              .stiffness(Spring.defaultEffects.stiffness)
              .damping(Spring.defaultEffects.damping)}
            exiting={FadeOut.duration(80)}
            layout={reflow}
          >
            {p.mode === "link" && <LinkFields {...p} />}
            {p.mode === "note" && <NoteFields {...p} />}
            {p.mode === "file" && <FileFields {...p} />}
          </Animated.View>
        </>
      )}

      {(p.mode === "link" || p.highlightDraft) && <TagRow {...p} />}
      <CollectionRow
        folderId={p.folderId}
        setFolderId={p.setFolderId}
        onMore={() => p.onPicker("folder")}
      />

      <Animated.View layout={reflow} style={{ marginTop: 22 }}>
        <SplitButton
          label={
            p.busy
              ? "Saving…"
              : p.highlightDraft
                ? "Save highlight"
                : SAVE_LABEL[p.mode]
          }
          icon="bookmarkAdd"
          onPress={() => canSave && p.onSave()}
          onMenu={() => p.onPicker("folder")}
          menuLabel="Choose another collection"
        />
      </Animated.View>
    </View>
  );
}

function inputStyle(color: string) {
  return { color, fontFamily: FONT_FAMILY, padding: 0 } as const;
}

function LinkFields(p: FormProps) {
  const { colors, dark } = useAppTheme();
  const link = extractUrl(p.url) ?? p.url.trim();
  const host = link ? hostOf(link) : "";
  const tone = collectionTones(hostSeed(link || "link"), dark);
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
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
          <Text variant="headlineSmall" color={tone.onContainer}>
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
        <View style={{ flex: 1, minWidth: 0 }}>
          <TextInput
            value={p.url}
            onChangeText={p.setUrl}
            placeholder="Paste a link"
            placeholderTextColor={colors.onSurfaceVariant}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Link"
            style={[inputStyle(colors.onSurfaceVariant), Type.labelSmall]}
          />
          <TextInput
            value={p.title}
            onChangeText={p.setTitle}
            placeholder={host || "Title"}
            placeholderTextColor={withAlpha(colors.onSurface, 0.5)}
            accessibilityLabel="Title"
            style={[
              inputStyle(colors.onSurface),
              Type.labelLarge,
              { marginTop: 2 },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const TOOLBAR: {
  label: string;
  icon?: "checklist" | "code";
  text?: string;
  insert: string;
}[] = [
  { label: "Bold", text: "B", insert: "**bold**" },
  { label: "Italic", text: "I", insert: "_italic_" },
  { label: "Heading", text: "H", insert: "\n## " },
  { label: "Checklist", icon: "checklist", insert: "\n- [ ] " },
  { label: "Code", icon: "code", insert: "`code`" },
];

function NoteFields(p: FormProps) {
  const { colors } = useAppTheme();
  const body = useRef<ComponentRef<typeof TextInput>>(null);
  const [sel, setSel] = useState({
    start: p.noteBody.length,
    end: p.noteBody.length,
  });
  const insert = (text: string) => {
    const next =
      p.noteBody.slice(0, sel.start) + text + p.noteBody.slice(sel.end);
    p.setNoteBody(next);
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
            Type.titleMedium,
            {
              fontWeight: "800",
              fontSize: 18,
              paddingHorizontal: 16,
              paddingTop: 14,
            },
          ]}
        />
        <TextInput
          ref={body}
          value={p.noteBody}
          onChangeText={p.setNoteBody}
          onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
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
              onPress={() => insert(t.insert)}
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
                  variant="labelLarge"
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
        <Text variant="labelSmall" color="onSurfaceVariant">
          Markdown supported
        </Text>
      </View>
    </View>
  );
}

function FileFields(p: FormProps) {
  const { colors } = useAppTheme();
  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*", "text/*", "*/*"],
      multiple: true,
      copyToCacheDirectory: true,
    });
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
        <Text variant="labelLarge">Choose a PDF or file</Text>
        <Text variant="labelSmall" color="onSurfaceVariant">
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
                variant="labelSmall"
                color="onTertiaryContainer"
                style={{ fontWeight: "800", fontSize: 11 }}
              >
                {f.type === "pdf" ? "PDF" : f.type === "image" ? "IMG" : "FILE"}
              </Text>
            </View>
            <Text variant="labelLarge" numberOfLines={1} style={{ flex: 1 }}>
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
        <Text variant="overline" color="primary">
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
        <Text variant="overline" color="primary">
          Collection
        </Text>
        {collections.length > 2 && (
          <Button label="More" variant="text" size="xs" onPress={onMore} />
        )}
      </View>
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
    folder?.name ?? (saved.highlightIds.length ? "Highlights" : "Inbox");
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
        variant="headlineSmall"
        style={{ marginTop: 10, textAlign: "center" }}
      >
        {`Saved to ${where}`}
      </Text>
      <Text
        variant="bodyMedium"
        color="onSurfaceVariant"
        style={{ textAlign: "center" }}
      >
        {SAVED_HINT[saved.mode]}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Button
          label="Undo"
          variant="outlined"
          size="s"
          height={48}
          onPress={onUndo}
        />
        {saved.viewId && (
          <Button
            label="View item"
            variant="tonal"
            size="s"
            height={48}
            onPress={onView}
          />
        )}
      </View>
    </Animated.View>
  );
}
