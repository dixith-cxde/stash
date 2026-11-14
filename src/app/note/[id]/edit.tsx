import { useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { createBookmark, getBookmark, updateBookmark } from '@/db/repo';
import { OrganizeCard } from '@/features/detail/OrganizeCard';
import { MarkdownView } from '@/features/notes/MarkdownView';
import { tintMarkdown } from '@/features/notes/tint';
import { tasksIn, toggleTask } from '@/features/stash/model';
import { haptic } from '@/motion/haptics';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { useAppTheme } from '@/theme/AppTheme';
import { FONT_FAMILY, MONO_FAMILY, Type } from '@/theme/type';
import { BackPill } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { IconButton } from '@/ui/IconButton';
import { PressableSurface } from '@/ui/PressableSurface';
import { SegmentedTabs } from '@/ui/SegmentedTabs';
import { Text } from '@/ui/Text';

export default function EditNote() {
  return (
    <TransitionScreen kind="axisY">
      <Editor />
    </TransitionScreen>
  );
}

type Tab = 'write' | 'preview';
const TABS: { key: Tab; label: string }[] = [
  { key: 'write', label: 'Write' },
  { key: 'preview', label: 'Preview' },
];

/** Formatting actions: wrap the selection, or insert at the start of the current line. */
const TOOLS: { label: string; icon?: 'formatListBulleted' | 'checklist' | 'formatQuote' | 'code' | 'link' | 'image'; glyph?: string; wrap?: [string, string]; line?: string }[] = [
  { label: 'Bold', glyph: 'B', wrap: ['**', '**'] },
  { label: 'Italic', glyph: 'I', wrap: ['_', '_'] },
  { label: 'Heading', glyph: 'H', line: '## ' },
  { label: 'Bulleted list', icon: 'formatListBulleted', line: '- ' },
  { label: 'Checklist', icon: 'checklist', line: '- [ ] ' },
  { label: 'Quote', icon: 'formatQuote', line: '> ' },
  { label: 'Code', icon: 'code', wrap: ['`', '`'] },
  { label: 'Web link', icon: 'link', wrap: ['[', '](https://)'] },
  { label: 'Link a saved item', glyph: '[[ ]]', wrap: ['[[', ']]'] },
];

const SAVE_DELAY = 600;
const HISTORY = 50;

/**
 * Markdown editor (design: Editor artboard). Opens from a note with a shared-axis slide;
 * syntax is tinted as you type; a formatting toolbar rides the keyboard; changes save
 * automatically (debounced) with a "Saving… / Saved" status; Undo walks back edits.
 */
function Editor() {
  const { id, folderId } = useLocalSearchParams<{ id: string; folderId?: string }>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const isNew = id === 'new';
  const [noteId, setNoteId] = useState<string | null>(isNew ? null : id);
  const { data: b, loading } = useDbQuery(() => (noteId ? getBookmark(noteId) : Promise.resolve(null)), [noteId], null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tab, setTab] = useState<Tab>('write');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  const ready = useRef(isNew);
  const sel = useRef({ start: 0, end: 0 });
  const history = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  // Load the note once.
  useEffect(() => {
    if (ready.current || loading || !b) return;
    ready.current = true;
    setTitle(b.title);
    setBody(b.content ?? '');
  }, [b, loading]);

  const persist = useCallback(
    async (t: string, md: string) => {
      if (!t.trim() && !md.trim() && !noteId) return;
      if (noteId) {
        await updateBookmark(noteId, { title: t.trim() || 'Untitled note', content: md });
      } else {
        const created = await createBookmark({ type: 'text', title: t.trim() || 'Untitled note', content: md, folderId: folderId || null, fetchStatus: 'done' });
        setNoteId(created);
      }
      setStatus('saved');
    },
    [noteId, folderId],
  );

  const schedule = (t: string, md: string) => {
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(t, md), SAVE_DELAY);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const changeBody = (md: string) => {
    if (history.current[history.current.length - 1] !== body) history.current = [...history.current, body].slice(-HISTORY);
    setBody(md);
    schedule(title, md);
  };

  const undo = () => {
    const prev = history.current.pop();
    if (prev === undefined) return;
    setBody(prev);
    schedule(title, prev);
  };

  const apply = (tool: (typeof TOOLS)[number]) => {
    const { start, end } = sel.current;
    let next = body;
    if (tool.wrap) {
      next = body.slice(0, start) + tool.wrap[0] + body.slice(start, end) + tool.wrap[1] + body.slice(end);
    } else if (tool.line) {
      const lineStart = body.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      next = body.slice(0, lineStart) + tool.line + body.slice(lineStart);
    }
    changeBody(next);
    input.current?.focus();
  };

  const done = async () => {
    clearTimeout(timer.current);
    await persist(title, body);
    haptic.save();
    close();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <BackPill label="Back" onPress={() => void persist(title, body).then(close)} />
        <View style={styles.status} accessibilityLiveRegion="polite">
          {status === 'saving' ? (
            <LoadingIndicator size={22} accessibilityLabel="Saving" />
          ) : (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <Ico name="cloudDone" size={18} color={colors.onSurfaceVariant} />
            </Animated.View>
          )}
          <Text variant="bodySmall" color="onSurfaceVariant" style={{ fontWeight: '600' }}>
            {status === 'saving' ? 'Saving…' : 'Saved'}
          </Text>
        </View>
        <IconButton icon="undo" accessibilityLabel="Undo" onPress={undo} />
        <Button label="Done" size="s" height={48} onPress={() => void done()} />
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
        <TextInput
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            schedule(t, body);
          }}
          placeholder="Title"
          placeholderTextColor={colors.onSurfaceVariant}
          accessibilityLabel="Title"
          style={[{ color: colors.onSurface, fontFamily: FONT_FAMILY, padding: 0 }, Type.headlineMedium]}
        />
        {b && (
          <View style={{ marginTop: 10 }}>
            <OrganizeCard b={b} compact />
          </View>
        )}
      </View>

      <View style={{ marginHorizontal: 16, marginTop: 16 }}>
        <SegmentedTabs items={TABS} value={tab} onChange={setTab} accessibilityLabel="Editor mode" track={colors.surfaceContainer} />
      </View>

      {tab === 'write' ? (
        <Animated.View key="write" entering={FadeIn.duration(180)} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 }}>
            <TextInput
              ref={input}
              multiline
              onChangeText={changeBody}
              onSelectionChange={(e) => (sel.current = e.nativeEvent.selection)}
              placeholder="Start writing… Markdown works: **bold**, _italic_, ## heading, - [ ] task"
              placeholderTextColor={colors.onSurfaceVariant}
              accessibilityLabel="Markdown source"
              scrollEnabled={false}
              style={{ color: colors.onSurface, fontFamily: MONO_FAMILY, fontSize: 14, lineHeight: 24, padding: 0, textAlignVertical: 'top', minHeight: 300 }}
            >
              {tintMarkdown(body, colors)}
            </TextInput>
          </ScrollView>
        </Animated.View>
      ) : (
        <Animated.View key="preview" entering={FadeIn.duration(180)} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 }}>
            <MarkdownView
              markdown={body}
              onToggleTask={(i) => {
                const t = tasksIn(body)[i];
                if (t) changeBody(toggleTask(body, t.line));
              }}
            />
          </ScrollView>
        </Animated.View>
      )}

      {tab === 'write' && (
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }} style={[styles.toolbarWrap, { bottom: insets.bottom + 20 }]}>
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
            accessibilityRole="toolbar"
            accessibilityLabel="Formatting"
            style={[styles.toolbar, { backgroundColor: colors.surfaceContainerHigh }]}
            contentContainerStyle={{ alignItems: 'center', gap: 2, paddingHorizontal: 8 }}
          >
            {TOOLS.map((t) => (
              <PressableSurface
                key={t.label}
                kind="button"
                corner={14}
                pressedCorner={22}
                onPress={() => apply(t)}
                accessibilityLabel={t.label}
                style={{ minWidth: 44, height: 44, paddingHorizontal: t.glyph && t.glyph.length > 1 ? 12 : 0, alignItems: 'center', justifyContent: 'center' }}
              >
                {t.icon ? (
                  <Ico name={t.icon} size={22} color={colors.onSurface} />
                ) : (
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '800',
                      fontStyle: t.glyph === 'I' ? 'italic' : 'normal',
                      fontFamily: t.glyph === '[[ ]]' ? MONO_FAMILY : FONT_FAMILY,
                      color: t.glyph === '[[ ]]' ? colors.primary : colors.onSurface,
                    }}
                  >
                    {t.glyph}
                  </Text>
                )}
              </PressableSurface>
            ))}
          </ScrollView>
        </KeyboardStickyView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  status: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolbarWrap: { position: 'absolute', left: 12, right: 12 },
  toolbar: { height: 64, borderRadius: 32, flexGrow: 0, boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.45)' },
});
