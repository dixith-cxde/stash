import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { getBookmark, updateBookmark } from '@/db/repo';
import { springTo, useSprings } from '@/motion/springs';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { useAppTheme } from '@/theme/AppTheme';
import { withAlpha } from '@/theme/palette';
import { ActionSheet } from '@/ui/ActionSheet';
import { BackPill } from '@/ui/BackPill';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';
import { ZoomableImage } from '@/ui/ZoomableImage';

/**
 * In-app viewer for a saved image: fitted to the screen, pinch / double tap to zoom, pan and
 * fling. Tap to show or hide the top bar. Share or open it in another app from the menu.
 */
export default function ImageScreen() {
  return (
    <TransitionScreen kind="axisY">
      <ImageBody />
    </TransitionScreen>
  );
}

function ImageBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: b, loading } = useDbQuery(() => getBookmark(id), [id], null);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const springs = useSprings();
  const [menu, setMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const toggle = useCallback(() => setHidden((h) => !h), []);

  const fade = useSharedValue(1);
  useEffect(() => {
    fade.set(springTo(hidden ? 0 : 1, springs.defaultEffects));
  }, [hidden, springs, fade]);
  const barStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  const uri = b ? (b.filePath ?? b.thumbPath ?? b.imageUrl) : null;
  const unread = !!b && !b.readAt;
  useEffect(() => {
    if (unread) void updateBookmark(id, { readAt: new Date() });
  }, [unread, id]);

  const share = () => {
    if (b?.filePath) void Sharing.shareAsync(b.filePath, { mimeType: b.mimeType ?? 'image/*', dialogTitle: b.title });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLowest }}>
      {uri ? (
        <ZoomableImage uri={uri} onTap={toggle} accessibilityLabel={b?.title || 'Image'} />
      ) : (
        !loading && (
          <View style={styles.center}>
            <Text variant="titleMedium">This image is gone.</Text>
          </View>
        )
      )}

      <Animated.View
        style={[styles.top, { paddingTop: insets.top + 8, backgroundColor: withAlpha(colors.surfaceContainerLowest, 0.85) }, barStyle]}
        pointerEvents={hidden ? 'none' : 'box-none'}
      >
        <BackPill label="Back" onPress={close} />
        <Text variant="titleSmall" numberOfLines={1} style={{ flex: 1 }}>
          {b?.title ?? ''}
        </Text>
        {b?.filePath ? <IconButton icon="moreVert" accessibilityLabel="Image options" variant="tonal" onPress={() => setMenu(true)} /> : null}
      </Animated.View>

      {menu && b && (
        <ActionSheet
          title={b.title}
          onDismiss={() => setMenu(false)}
          actions={[{ label: 'Share or open in another app', icon: 'share', onPress: share }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
});
