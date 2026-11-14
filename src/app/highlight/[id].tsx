import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { deleteHighlight, getHighlight } from '@/db/repo';
import { relativeTime } from '@/lib/format';
import { haptic } from '@/motion/haptics';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { useColors } from '@/theme/AppTheme';
import { ActionSheet } from '@/ui/ActionSheet';
import { BackPill, HeroIconButton } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { TagPill } from '@/ui/Chip';
import { Ico } from '@/ui/Ico';
import { IconButton } from '@/ui/IconButton';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

/** A standalone highlight (shared in from another app): the quote, where it came from, its note. */
export default function HighlightScreen() {
  const { origin } = useLocalSearchParams<{ origin?: string }>();
  return (
    <TransitionScreen kind="container" origin={origin}>
      <HighlightBody />
    </TransitionScreen>
  );
}

function HighlightBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const { data: h } = useDbQuery(() => getHighlight(id), [id], null);
  const [menu, setMenu] = useState(false);

  if (!h) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  const source = h.sourceTitle || h.bookmarkTitle || h.sourceApp;
  const shareText = source ? `“${h.text}”\n— ${source}` : `“${h.text}”`;

  const remove = () =>
    void deleteHighlight(h.id).then(() => {
      haptic.remove();
      showSnackbar('Highlight deleted');
      close();
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120 + insets.bottom }}>
        <View style={styles.bar}>
          <BackPill label="Back" onPress={close} />
          <HeroIconButton icon="moreVert" label="More" onPress={() => setMenu(true)} />
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <View style={[styles.quote, { backgroundColor: colors.tertiaryContainer }]}>
            <Ico name="formatQuote" size={36} color={colors.onTertiaryContainer} />
            <Text variant="quote" color="onTertiaryContainer" selectable style={{ marginTop: 8, fontSize: 24, lineHeight: 32 }}>
              {h.text}
            </Text>
            <Text variant="labelMedium" color="onTertiaryContainer" style={{ marginTop: 16, opacity: 0.8 }}>
              {[source, h.page ? `p. ${h.page}` : null, `Saved ${relativeTime(h.createdAt)}`].filter(Boolean).join(' · ')}
            </Text>
          </View>

          {h.note ? (
            <>
              <Text variant="overline" color="primary" style={styles.section}>
                Your note
              </Text>
              <Text variant="bodyLarge" selectable>
                {h.note}
              </Text>
            </>
          ) : null}

          {h.tags.length > 0 && (
            <>
              <Text variant="overline" color="primary" style={styles.section}>
                Tags
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {h.tags.map((t) => (
                  <TagPill key={t.id} label={t.name} />
                ))}
              </View>
            </>
          )}

          {h.sourceUrl && /^https?:\/\//i.test(h.sourceUrl) ? (
            <View style={{ marginTop: 24, alignSelf: 'flex-start' }}>
              <Button
                label="Open source"
                icon="openInNew"
                variant="tonal"
                // Only web links: the URL came from another app's share and could be any scheme.
                onPress={() => void Linking.openURL(h.sourceUrl as string)}
              />
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      <View style={[styles.dock, { bottom: insets.bottom + 20 }]}>
        <Button
          label="Copy"
          icon="contentCopy"
          height={64}
          corners={[32, 12, 12, 32]}
          grow
          onPress={() =>
            void Clipboard.setStringAsync(h.text).then(() => showSnackbar('Copied'))
          }
          style={styles.shadow}
        />
        <IconButton
          icon="share"
          accessibilityLabel="Share"
          variant="tonal"
          size={64}
          corners={[12, 32, 32, 12]}
          onPress={() => void Share.share({ message: shareText })}
          style={styles.shadow}
        />
      </View>

      {menu && (
        <ActionSheet
          title="Highlight"
          onDismiss={() => setMenu(false)}
          actions={[{ label: 'Delete highlight', icon: 'delete', destructive: true, onPress: remove }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  quote: { borderRadius: 28, padding: 24 },
  section: { marginTop: 24, marginBottom: 8 },
  dock: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 4 },
  shadow: { boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.45)' },
});
