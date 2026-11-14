import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enterFade, exitFade } from '@/motion/layout';
import { Duration } from '@/motion/tokens';
import { useAppTheme } from '@/theme/AppTheme';
import { Ico } from '@/ui/Ico';
import { Portal } from '@/ui/Portal';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

import { displayRatio, isTinyImage } from './images';

type Props = {
  /** Absolute URL (see readerImageUrl). */
  uri: string;
  alt?: string | null;
  /** Shown under the image: the figure caption, else the image title or alt text. */
  caption?: string | null;
  /** Width/height when known up front (skips the 16:9 placeholder jump). */
  width?: number;
  height?: number;
  corner?: number;
  style?: object;
};

/**
 * An article image at full width and its own aspect ratio (measured on load, never stretched),
 * with a tonal placeholder while it loads, an optional caption, and tap to view it larger.
 * Tiny images (icons, emoji) and failed loads collapse to nothing.
 */
export const ReaderImage = memo(function ReaderImage({ uri, alt, caption, width, height, corner = 24, style }: Props) {
  const { colors } = useAppTheme();
  const [size, setSize] = useState<{ w: number; h: number } | null>(width && height ? { w: width, h: height } : null);
  const [gone, setGone] = useState(false);
  const [open, setOpen] = useState(false);
  if (gone) return null;
  const { ratio, clamped } = displayRatio(size?.w ?? 0, size?.h ?? 0);
  const label = caption || alt || undefined;

  return (
    <View style={[{ marginTop: 20 }, style]}>
      <PressableSurface
        kind="card"
        corner={corner}
        onPress={() => setOpen(true)}
        accessibilityLabel={label ? `Image: ${label}. View larger` : 'Image. View larger'}
        style={{ width: '100%', aspectRatio: ratio, backgroundColor: colors.surfaceContainerHigh }}
      >
        {!size && (
          <View style={styles.placeholder} pointerEvents="none">
            <Ico name="image" size={32} color={colors.onSurfaceVariant} />
          </View>
        )}
        <Image
          source={uri}
          recyclingKey={uri}
          style={StyleSheet.absoluteFill}
          // The box already has the image's ratio, so cover does not crop; clamped (very tall or
          // wide) images letterbox instead.
          contentFit={clamped ? 'contain' : 'cover'}
          transition={Duration.short3}
          onLoad={(e) => {
            const { width: w, height: h } = e.source;
            if (isTinyImage(w, h)) setGone(true);
            else if (w && h && (!size || size.w !== w || size.h !== h)) setSize({ w, h });
          }}
          onError={() => setGone(true)}
        />
      </PressableSurface>
      {caption ? (
        <Text variant="bodySmall" color="onSurfaceVariant" selectable style={styles.caption}>
          {caption}
        </Text>
      ) : null}
      {open && <ImageViewer uri={uri} alt={label} ratio={size ? size.w / size.h : ratio} onClose={() => setOpen(false)} />}
    </View>
  );
});

/** Full-screen view of one image on a scrim. Tap anywhere or press back to close. */
function ImageViewer({ uri, alt, ratio, onClose }: { uri: string; alt?: string; ratio: number; onClose: () => void }) {
  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);
  return (
    <Portal>
      <Animated.View entering={enterFade} exiting={exitFade} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}>
        <PressableSurface
          kind="card"
          corner={0}
          pressedCorner={0}
          pressedScale={1}
          onPress={onClose}
          accessibilityLabel="Close image"
          style={[StyleSheet.absoluteFill, styles.viewer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
        >
          <Image source={uri} recyclingKey={uri} style={{ width: '100%', aspectRatio: ratio, maxHeight: '100%' }} contentFit="contain" />
          {alt ? (
            <Text variant="bodyMedium" color={dark ? colors.onSurface : colors.inverseOnSurface} style={styles.viewerCaption} numberOfLines={4}>
              {alt}
            </Text>
          ) : null}
        </PressableSurface>
      </Animated.View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  placeholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', opacity: 0.6 },
  caption: { marginTop: 8, paddingHorizontal: 4, fontStyle: 'italic' },
  viewer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 },
  viewerCaption: { marginTop: 16, paddingHorizontal: 24, textAlign: 'center' },
});
