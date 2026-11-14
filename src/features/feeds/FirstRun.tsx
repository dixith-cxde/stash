import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { findFeedByUrl } from '@/db/repo';
import { hostSeed } from '@/features/stash/model';
import { haptic } from '@/motion/haptics';
import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { Layout } from '@/theme/tokens';
import { FONT_FAMILY, Type } from '@/theme/type';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

import { sourceGlyph } from './ArticleCard';
import { addFeed, deleteFeed, FeedError } from './sync';

/** Well-known feeds to start from (design: Feeds, empty state). */
export const STARTER_FEEDS = [
  { name: 'The Verge', about: 'Tech and culture · many a day', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Android Developers', about: 'Platform news · weekly', url: 'https://android-developers.googleblog.com/atom.xml' },
  { name: 'Smashing Magazine', about: 'Design and front end · daily', url: 'https://www.smashingmagazine.com/feed/' },
  { name: 'Ars Technica', about: 'Science and tech · many a day', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'Hacker News', about: 'Front page links · hourly', url: 'https://hnrss.org/frontpage' },
];

type FollowState = 'idle' | 'busy' | 'on';

/**
 * Follow / Following toggle per starter feed; following one really subscribes.
 * `followed`: feed URLs already subscribed, shown as Following.
 */
export function useFollow(followed: readonly string[] = []) {
  const [state, setState] = useState<Record<string, FollowState>>({});
  const [ids, setIds] = useState<Record<string, string>>({});
  const stateOf = (url: string): FollowState => state[url] ?? (followed.includes(url) ? 'on' : 'idle');
  const toggle = async (url: string, name: string) => {
    const now = stateOf(url);
    if (now === 'busy') return;
    setState((s) => ({ ...s, [url]: 'busy' }));
    try {
      if (now === 'on') {
        const id = ids[url] ?? (await findFeedByUrl(url))?.id;
        if (id) await deleteFeed(id);
        haptic.remove();
        setState((s) => ({ ...s, [url]: 'idle' }));
      } else {
        const { id } = await addFeed(url);
        haptic.save();
        setIds((m) => ({ ...m, [url]: id }));
        setState((s) => ({ ...s, [url]: 'on' }));
      }
    } catch {
      showSnackbar(`Couldn't reach ${name}. Check your connection.`);
      setState((s) => ({ ...s, [url]: now }));
    }
  };
  const following = STARTER_FEEDS.filter((f) => stateOf(f.url) === 'on').length;
  return { stateOf, toggle, following };
}

/** A suggested source: tone tile, name, what it covers, Follow toggle. */
export function PopularRow({ f, state, onToggle }: { f: (typeof STARTER_FEEDS)[number]; state: FollowState; onToggle: () => void }) {
  const { colors, dark } = useAppTheme();
  const tone = collectionTones(hostSeed(f.url), dark);
  const on = state === 'on';
  return (
    <View style={[styles.pop, { backgroundColor: colors.surfaceContainer }]}>
      <View style={[styles.popTile, { backgroundColor: tone.container }]}>
        <Text variant="titleLarge" color={tone.onContainer} style={{ fontWeight: '800' }}>
          {sourceGlyph(f.name)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="titleSmall" numberOfLines={1} style={{ fontSize: 15, fontWeight: '700' }}>
          {f.name}
        </Text>
        <Text variant="bodySmall" color="onSurfaceVariant" numberOfLines={1} style={{ marginTop: 2 }}>
          {f.about}
        </Text>
      </View>
      {state === 'busy' ? (
        <View style={styles.popBusy}>
          <LoadingIndicator size={36} />
        </View>
      ) : (
        <Button
          label={on ? 'Following' : 'Follow'}
          icon={on ? 'check' : undefined}
          size="s"
          variant={on ? 'tonal' : 'filled'}
          shape={on ? 'square' : 'round'}
          onPress={onToggle}
          accessibilityLabel={on ? `Unfollow ${f.name}` : `Follow ${f.name}`}
        />
      )}
    </View>
  );
}

/** Follow by site or feed address: the hero card's field and split Follow button. */
function AddressForm({ onAdded }: { onAdded: () => void }) {
  const { colors } = useAppTheme();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async () => {
    if (busy) return;
    if (!url.trim()) return setMsg('Paste a site like theverge.com or a feed link.');
    setBusy(true);
    setMsg(`Looking for a feed on ${url.trim().replace(/^https?:\/\//, '')}…`);
    try {
      const { existed } = await addFeed(url);
      haptic.save();
      showSnackbar(existed ? 'You already follow that feed' : 'Feed added');
      setUrl('');
      setMsg(null);
      onAdded();
    } catch (e) {
      setMsg(e instanceof FeedError ? e.message : "Couldn't read a feed there.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <View style={styles.form}>
        <View style={[styles.field, { borderColor: colors.onPrimaryContainer }]}>
          <Ico name="link" size={20} color={colors.onPrimaryContainer} />
          <TextInput
            value={url}
            onChangeText={(t) => {
              setUrl(t);
              setMsg(null);
            }}
            placeholder="Site or feed address"
            placeholderTextColor={colors.onPrimaryContainer}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            accessibilityLabel="Site or feed address"
            style={{ flex: 1, minWidth: 0, color: colors.onPrimaryContainer, fontFamily: FONT_FAMILY, ...Type.bodyLarge, fontSize: 15, paddingVertical: 0 }}
          />
          {busy && <LoadingIndicator size={28} color={colors.onPrimaryContainer} />}
        </View>
        <Button label="Follow" height={52} corners={[10, 26, 26, 10]} onPress={() => void submit()} disabled={busy} />
      </View>
      {msg ? (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Text variant="labelLarge" color={colors.onPrimaryContainer} style={{ marginTop: 10 }}>
            {msg}
          </Text>
        </Animated.View>
      ) : null}
    </>
  );
}

/**
 * Feeds with no subscriptions yet (design: Feeds, empty state): a welcome card with a
 * follow-by-address field, popular sources to follow in one tap, and a note on battery use.
 * `onDone` leaves for the article list once something is followed.
 */
export function FirstRun({ onDone }: { onDone: () => void }) {
  const { colors } = useAppTheme();
  const { stateOf, toggle, following } = useFollow();
  return (
    <View>
      <View style={[styles.hero, { backgroundColor: colors.primaryContainer }]}>
        <View style={styles.heroDecor} pointerEvents="none">
          <Shape name="cookie12Sided" size={230} color={colors.primary} style={{ opacity: 0.35 }} />
        </View>
        <View style={[styles.heroIcon, { backgroundColor: colors.onPrimaryContainer }]}>
          <Ico name="rssFeed" size={26} color={colors.primaryContainer} />
        </View>
        <Text variant="headlineMedium" color="onPrimaryContainer" style={{ marginTop: 16, fontWeight: '800' }}>
          Your reading, delivered
        </Text>
        <Text variant="bodyMedium" color="onPrimaryContainer" style={{ marginTop: 6, fontSize: 15, lineHeight: 21, opacity: 0.85 }}>
          New articles from sites you follow land here, newest first. Save the ones worth keeping.
        </Text>
        <AddressForm onAdded={onDone} />
      </View>

      <View style={styles.sectionHead}>
        <Text variant="titleLarge" style={{ fontWeight: '700' }}>
          Popular to start
        </Text>
        {following > 0 && (
          <Text variant="labelLarge" color="onSurfaceVariant">
            {`${following} following`}
          </Text>
        )}
      </View>
      <View style={{ gap: 4, paddingHorizontal: Layout.gutter }}>
        {STARTER_FEEDS.map((f) => (
          <PopularRow key={f.url} f={f} state={stateOf(f.url)} onToggle={() => void toggle(f.url, f.name)} />
        ))}
      </View>

      {following > 0 && (
        <Animated.View entering={FadeIn} style={{ paddingHorizontal: Layout.gutter, paddingTop: 20 }}>
          <Button label="Show my feed" icon="arrowForward" height={56} onPress={onDone} />
        </Animated.View>
      )}

      <View style={styles.note}>
        <Ico name="smartphone" size={18} color={colors.onSurfaceVariant} />
        <Text variant="bodySmall" color="onSurfaceVariant" style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>
          Feeds check for new articles when you open this tab, a few times a day at most. Nothing runs in the background.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: Layout.gutter, marginTop: 20, borderRadius: 32, padding: 20, paddingTop: 24, overflow: 'hidden' },
  heroDecor: { position: 'absolute', right: -70, top: -80 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  form: { flexDirection: 'row', gap: 6, marginTop: 18 },
  field: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderTopLeftRadius: 26,
    borderBottomLeftRadius: 26,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: Layout.gutter + 8, paddingTop: 28, paddingBottom: 12 },
  pop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 24 },
  popTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  popBusy: { width: 96, height: 40, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginHorizontal: Layout.gutter + 8, marginTop: 20 },
});
