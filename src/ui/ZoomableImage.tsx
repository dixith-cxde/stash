import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { Duration } from '@/motion/tokens';

import { type Size, useZoomPan, zoomContentBase } from './ZoomPan';

type Props = {
  uri: string;
  /** Width / height when known; otherwise measured when the image loads. */
  ratio?: number;
  onTap?: () => void;
  accessibilityLabel?: string;
};

/**
 * An image fitted to the box it fills, with pinch zoom, pan and fling, and double tap to zoom.
 * Used by the image viewer page and the reader's full-screen image.
 */
export function ZoomableImage({ uri, ratio: known, onTap, accessibilityLabel }: Props) {
  const [box, setBox] = useState<Size>({ w: 0, h: 0 });
  const [measured, setMeasured] = useState<number | null>(null);
  const ratio = known ?? measured ?? 1;

  const content = useMemo(() => {
    if (!box.w || !box.h) return { w: 0, h: 0 };
    const w = Math.min(box.w, box.h * ratio);
    return { w, h: w / ratio };
  }, [box, ratio]);

  const zoom = useZoomPan({ viewport: box, content, maxScale: 6, onTap });

  return (
    <GestureDetector gesture={zoom.gesture}>
      <View
        style={styles.fill}
        collapsable={false}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Pinch or double tap to zoom"
      >
        <Animated.View style={[zoomContentBase, { width: content.w, height: content.h }, zoom.style]}>
          <Image
            source={uri}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={Duration.short3}
            onLoad={(e) => {
              const { width, height } = e.source;
              if (!known && width && height) setMeasured(width / height);
            }}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
});
