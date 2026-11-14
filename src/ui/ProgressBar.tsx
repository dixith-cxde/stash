import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { springTo, useSprings } from '@/motion/springs';
import { useColors } from '@/theme/AppTheme';

type Props = {
  /** 0..1 */
  value: number;
  /** Stroke thickness (M3: 4; the note checklist uses 6). */
  height?: number;
  /** Active indicator color (primary by default). */
  color?: string;
  /** Track color (secondaryContainer by default, per androidx). */
  trackColor?: string;
  /**
   * Wavy active indicator (M3 Expressive): amplitude 3, wavelength 40. The wave is still, not
   * travelling, so a progress bar on screen costs nothing between updates.
   */
  wavy?: boolean;
  accessibilityLabel?: string;
};

const GAP = 4;
const AMPLITUDE = 3;
const WAVELENGTH = 40;

/**
 * M3 linear progress indicator: rounded active indicator, a 4dp gap, then the track, which
 * ends in a 4dp stop indicator (accessibility: shows where 100% is). The value springs to
 * each new target (defaultSpatial). Wavy flattens near 0 and 100% like androidx.
 */
export function ProgressBar({ value, height = 4, color, trackColor, wavy, accessibilityLabel }: Props) {
  const colors = useColors();
  const springs = useSprings();
  const clamped = Math.min(1, Math.max(0, value));
  const p = useSharedValue(clamped);
  const [width, setWidth] = useState(0);
  const boxHeight = wavy ? height + AMPLITUDE * 2 + 2 : height;
  const mid = boxHeight / 2;
  const stroke = height;
  const half = stroke / 2;

  useEffect(() => {
    p.set(springTo(clamped, springs.defaultSpatial));
  }, [clamped, springs, p]);

  const active = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make();
    const v = Math.min(1, Math.max(0, p.get()));
    const end = half + (width - stroke) * v;
    if (v <= 0.001 || width <= 0) return path.detach();
    path.moveTo(half, mid);
    // androidx: no wave while progress ≤ 10% or ≥ 95%.
    const amp = wavy && v > 0.1 && v < 0.95 ? AMPLITUDE : 0;
    if (amp === 0) {
      path.lineTo(Math.max(half, end), mid);
    } else {
      for (let x = half; x <= end; x += 2) path.lineTo(x, mid + Math.sin(((x - half) / WAVELENGTH) * Math.PI * 2) * amp);
      path.lineTo(end, mid + Math.sin(((end - half) / WAVELENGTH) * Math.PI * 2) * amp);
    }
    return path.detach();
  });

  const track = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make();
    const v = Math.min(1, Math.max(0, p.get()));
    const start = half + (width - stroke) * v + (v > 0.001 ? stroke + GAP : 0);
    const end = width - half;
    if (start < end) {
      path.moveTo(start, mid);
      path.lineTo(end, mid);
    }
    return path.detach();
  });

  const fill = color ?? colors.primary;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: boxHeight }}
    >
      {width > 0 && (
        <Canvas style={{ width, height: boxHeight }}>
          <Path path={track} style="stroke" strokeWidth={stroke} strokeCap="round" color={trackColor ?? colors.secondaryContainer} />
          <Path path={active} style="stroke" strokeWidth={stroke} strokeCap="round" strokeJoin="round" color={fill} />
          {clamped < 1 && <Circle cx={width - half} cy={mid} r={Math.min(2, half)} color={fill} />}
        </Canvas>
      )}
    </View>
  );
}
