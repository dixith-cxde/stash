import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarkdownView } from '@/features/notes/MarkdownView';
import { EndMatter } from '@/features/reader/EndMatter';
import { splitEndMatter } from '@/features/reader/endmatter';
import { useColors } from '@/theme/AppTheme';
import { Button } from '@/ui/Button';
import { ButtonGroup } from '@/ui/ButtonGroup';
import { CheckboxRow } from '@/ui/Checkbox';
import { Chip, TagPill } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { ProgressBar } from '@/ui/ProgressBar';
import { SegmentedTabs } from '@/ui/SegmentedTabs';
import { Sheet } from '@/ui/Sheet';
import { showSnackbar } from '@/ui/Snackbar';
import { SplitButton } from '@/ui/SplitButton';
import { Text } from '@/ui/Text';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'links', label: 'Links' },
  { key: 'pdfs', label: 'PDFs' },
  { key: 'notes', label: 'Notes' },
  { key: 'quotes', label: 'Quotes' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

const MODES = [
  { key: 'link', label: 'Link' },
  { key: 'note', label: 'Note' },
  { key: 'file', label: 'File' },
] as const;
type ModeKey = (typeof MODES)[number]['key'];

const TAGS = ['design', 'android', 'material-you', 'ux'];

/**
 * Dev-only component kit (stash://dev/kit). `?demo=1` cycles every control on a timer so
 * motion can be reviewed without touching the screen.
 */
export default function Kit() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { demo } = useLocalSearchParams<{ demo?: string }>();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [mode, setMode] = useState<ModeKey>('link');
  const [fav, setFav] = useState(true);
  const [tags, setTags] = useState<Record<string, boolean>>({ design: true });
  const [checks, setChecks] = useState([true, true, false, false]);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    if (!demo) return;
    let n = 0;
    const id = setInterval(() => {
      n++;
      setFilter(FILTERS[n % FILTERS.length].key);
      setMode(MODES[n % MODES.length].key);
      setFav((f) => !f);
      setMenu((m) => !m);
      setTags((t) => ({ ...t, [TAGS[n % TAGS.length]]: !t[TAGS[n % TAGS.length]] }));
      setChecks((c) => c.map((v, i) => (i === n % c.length ? !v : v)));
      if (n % 4 === 0) showSnackbar('Saved to Research', { label: 'Undo', onPress: () => {} });
    }, 1400);
    return () => clearInterval(id);
  }, [demo]);

  const done = checks.filter(Boolean).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 160, paddingHorizontal: 16, gap: 28 }}>
        <Text variant="displaySmallEmphasized">Kit</Text>

        <Section title="Buttons">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button label="Save" icon="add" />
            <Button label="Tonal" variant="tonal" />
            <Button label="Cancel" variant="outlined" size="s" height={44} />
            <Button label="Text" variant="text" size="s" />
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Button label="Read" icon="menuBook" corners={[28, 12, 12, 28]} grow />
            <IconButton
              icon="star"
              selectedIcon="starFill"
              accessibilityLabel="Favorite"
              size={56}
              variant="tonal"
              selected={fav}
              onPress={() => setFav((f) => !f)}
            />
            <IconButton icon="share" accessibilityLabel="Share" size={56} variant="tonal" corners={[12, 28, 28, 12]} />
          </View>
          <SplitButton
            label="Save link"
            icon="bookmarkAdd"
            onPress={() => showSnackbar('Saved to Research', { label: 'Undo', onPress: () => {} })}
            onMenu={() => setMenu((m) => !m)}
            menuOpen={menu}
            menuLabel="More save options"
          />
        </Section>

        <Section title="Connected button group">
          <ButtonGroup items={[...FILTERS]} value={filter} onChange={setFilter} accessibilityLabel="Filter by type" />
        </Section>

        <Section title="Segmented tabs">
          <SegmentedTabs items={[...MODES]} value={mode} onChange={setMode} accessibilityLabel="What to save" />
        </Section>

        <Section title="Chips">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TAGS.map((t) => (
              <Chip key={t} label={`#${t}`} selected={!!tags[t]} onPress={() => setTags((s) => ({ ...s, [t]: !s[t] }))} />
            ))}
            <Chip label="Tag" icon="add" />
            <TagPill label="#android" />
          </View>
        </Section>

        <Section title={`Checklist · ${done} of ${checks.length} done`}>
          <ProgressBar value={done / checks.length} height={6} />
          <View style={{ gap: 4 }}>
            {['Shape library: 35 forms', 'Spring motion vs easing curves', 'Type scale changes', 'Demo the saved article'].map(
              (label, i) => (
                <CheckboxRow
                  key={label}
                  label={label}
                  checked={checks[i]}
                  onChange={(v) => setChecks((c) => c.map((x, j) => (j === i ? v : x)))}
                />
              ),
            )}
          </View>
        </Section>

        <Section title="Sheet">
          <Button label="Open sheet" variant="tonal" onPress={() => setSheet(true)} />
        </Section>

        <Section title="Reader article">
          <View style={{ marginHorizontal: -20 }}>
            <View style={{ paddingHorizontal: 22 }}>
              <MarkdownView markdown={READER_SAMPLE.body} reading baseUrl="https://example.com/post" />
            </View>
            <EndMatter author={READER_SAMPLE.author} tags={READER_SAMPLE.tags} related={READER_SAMPLE.related} onOpen={(u) => showSnackbar(u)} />
          </View>
        </Section>
      </ScrollView>

      {sheet && (
        <Sheet accessibilityLabel="Save to Stash" onDismiss={() => setSheet(false)}>
          {(close) => (
            <View style={{ gap: 16 }}>
              <Text variant="headlineSmallEmphasized">Save to Stash</Text>
              <SegmentedTabs items={[...MODES]} value={mode} onChange={setMode} accessibilityLabel="What to save" />
              <Text color="onSurfaceVariant">Drag down, tap outside or press back to close.</Text>
              <Button label="Done" onPress={close} />
            </View>
          )}
        </Sheet>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Text variant="titleSmallEmphasized" color="primary">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Reader sample: a table, quotes, inline and block code, then end matter (dev only). */
const READER_SAMPLE = splitEndMatter(`Phones compared on the numbers that matter, with \`adb shell\` checks for each.

| Phone | Battery | Weight | Price |
| --- | :---: | ---: | ---: |
| Pixel 10 | 4,970 mAh | 204 g | $799 |
| Galaxy S26 | 4,000 mAh | 167 g | $799 |
| **vivo** X300 Pro | 6,510 mAh | 226 g | $1,099 |

> Battery size is not battery life.

> A longer quoted passage keeps its own paragraphs.
>
> - and its lists
> - with \`code\` too

\`\`\`kotlin
val phones = listOf("Pixel", "Galaxy", "vivo").map { it.uppercase() }.sortedByDescending { it.length }
\`\`\`

## Continue reading

- [The best Android phones of the year](https://example.com/best)
- [Why battery tests disagree](https://other.example.org/battery) – a look at the methods

*Written by [Jane Doe](https://example.com/jane)*

**Tags:** [Android](https://example.com/tag/android), [Phones](https://example.com/tag/phones), [Reviews](https://example.com/tag/reviews)`);
