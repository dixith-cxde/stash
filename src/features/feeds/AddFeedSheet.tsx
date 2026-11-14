import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { haptic } from '@/motion/haptics';
import { useColors } from '@/theme/AppTheme';
import { FONT_FAMILY, Type } from '@/theme/type';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Ico } from '@/ui/Ico';
import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { Sheet } from '@/ui/Sheet';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

import { addFeed, FeedError } from './sync';

/** A few well-known feeds to start from, one tap each. */
export const STARTER_FEEDS = [
  { label: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { label: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { label: 'Android Developers', url: 'https://android-developers.googleblog.com/atom.xml' },
  { label: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/' },
  { label: 'Hacker News', url: 'https://hnrss.org/frontpage' },
];

/** Subscribe by site or feed address (the feed is discovered from a site's page). */
export function AddFeedSheet({ onDismiss, onAdded }: { onDismiss: () => void; onAdded?: (id: string) => void }) {
  const colors = useColors();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (address: string, close: () => void) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id, existed } = await addFeed(address);
      haptic.save();
      showSnackbar(existed ? 'You already follow that feed' : 'Feed added');
      onAdded?.(id);
      close();
    } catch (e) {
      setError(e instanceof FeedError ? e.message : "Couldn't read a feed there.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet accessibilityLabel="Add feed" onDismiss={onDismiss}>
      {(close) => (
        <View style={{ gap: 16 }}>
          <Text variant="headlineSmall" style={{ paddingHorizontal: 8 }}>
            Add a feed
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, borderRadius: 28, paddingHorizontal: 20, backgroundColor: colors.surfaceContainerHighest }}>
            <Ico name="rssFeed" size={22} color={colors.onSurfaceVariant} />
            <TextInput
              value={url}
              onChangeText={(t) => {
                setUrl(t);
                setError(null);
              }}
              autoFocus
              placeholder="Site or feed address"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => void add(url, close)}
              accessibilityLabel="Site or feed address"
              style={{ flex: 1, color: colors.onSurface, fontFamily: FONT_FAMILY, ...Type.bodyLarge, paddingVertical: 0 }}
            />
            {busy && <LoadingIndicator size={28} />}
          </View>
          {error ? (
            <Text variant="bodyMedium" color="error" style={{ paddingHorizontal: 8 }}>
              {error}
            </Text>
          ) : null}
          <Text variant="overline" color="primary" style={{ paddingHorizontal: 8 }}>
            Popular
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STARTER_FEEDS.map((f) => (
              <Chip key={f.url} label={f.label} icon="add" onPress={() => void add(f.url, close)} />
            ))}
          </View>
          <Button label={busy ? 'Looking for the feed…' : 'Add feed'} disabled={busy || !url.trim()} onPress={() => void add(url, close)} />
        </View>
      )}
    </Sheet>
  );
}
