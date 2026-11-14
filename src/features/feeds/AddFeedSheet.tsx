import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useDbQuery } from '@/db/hooks';
import { listFeeds } from '@/db/repo';
import { haptic } from '@/motion/haptics';
import { useColors } from '@/theme/AppTheme';
import { FONT_FAMILY, Type } from '@/theme/type';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { Sheet, SheetScrollView } from '@/ui/Sheet';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

import { PopularRow, STARTER_FEEDS, useFollow } from './FirstRun';
import { addFeed, FeedError } from './sync';

/** Subscribe by site or feed address (the feed is discovered from a site's page). */
export function AddFeedSheet({ onDismiss, onAdded }: { onDismiss: () => void; onAdded?: (id: string) => void }) {
  const colors = useColors();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: feeds } = useDbQuery(listFeeds, [], []);
  const follow = useFollow(feeds.map((f) => f.url));

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
        <View style={{ gap: 16, flexShrink: 1 }}>
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
            Popular to start
          </Text>
          <SheetScrollView contentContainerStyle={{ gap: 4 }} keyboardShouldPersistTaps="handled">
            {STARTER_FEEDS.map((f) => (
              <PopularRow key={f.url} f={f} state={follow.stateOf(f.url)} onToggle={() => void follow.toggle(f.url, f.name)} />
            ))}
          </SheetScrollView>
          <Button label={busy ? 'Looking for the feed…' : 'Add feed'} disabled={busy || !url.trim()} onPress={() => void add(url, close)} />
        </View>
      )}
    </Sheet>
  );
}
