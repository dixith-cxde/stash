import { useCallback, useEffect } from "react";
import {
  BackHandler,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { springTo, useSprings } from "@/motion/springs";
import { MotionSpec } from "@/motion/tokens";
import { useColors } from "@/theme/AppTheme";

import { Portal } from "./Portal";

type Props = {
  /** Called after the sheet has animated away (drag, scrim tap, back, or `close()`). */
  onDismiss: () => void;
  /** Content; a function receives `close` to dismiss with the exit animation. */
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  accessibilityLabel: string;
};

/** Fraction of the sheet height past which a release dismisses it. */
const DISMISS_FRACTION = 0.35;
/** Downward fling velocity (dp/s) that dismisses regardless of distance. */
const DISMISS_VELOCITY = 900;

/**
 * Modal bottom sheet (design: Capture). Mounting opens it: it springs up from below on
 * defaultSpatial. It follows the finger 1:1, rubber-bands when pulled up, and on release
 * either springs back (defaultSpatial) or dismisses (fastSpatial) carrying the fling
 * velocity. The scrim fades with the sheet's position; the keyboard pushes it up frame by
 * frame. Back and scrim taps dismiss with the same animation. Renders in the root portal,
 * so it always sits above the whole screen wherever it is written.
 */
export function Sheet({ onDismiss, children, accessibilityLabel }: Props) {
  const colors = useColors();
  const springs = useSprings();
  const insets = useSafeAreaInsets();
  const keyboard = useReanimatedKeyboardAnimation();

  const height = useSharedValue(0);
  const y = useSharedValue(10_000);
  const start = useSharedValue(0);
  const opened = useSharedValue(false);

  const finish = useCallback(() => onDismiss(), [onDismiss]);

  const close = useCallback(() => {
    y.set(
      springTo(height.get() + 40, springs.fastSpatial, 0, (done) => {
        "worklet";
        if (done) scheduleOnRN(finish);
      }),
    );
  }, [y, height, springs, finish]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    height.set(h);
    if (!opened.get()) {
      opened.set(true);
      y.set(h);
      y.set(springTo(0, springs.defaultSpatial));
    }
  };

  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    failOffsetX: [-24, 24],
    onBegin: () => {
      "worklet";
      start.set(y.get());
    },
    onUpdate: (e) => {
      "worklet";
      const next = start.get() + e.translationY;
      // Pulling up past the open position resists (rubber band).
      y.set(next < 0 ? -Math.sqrt(-next) * 4 : next);
    },
    onDeactivate: (e) => {
      "worklet";
      const v = e.velocityY;
      if (
        v > DISMISS_VELOCITY ||
        (y.get() > height.get() * DISMISS_FRACTION && v > -200)
      ) {
        y.set(
          springTo(height.get() + 40, springs.fastSpatial, v, (done) => {
            "worklet";
            if (done) scheduleOnRN(finish);
          }),
        );
      } else {
        y.set(springTo(0, springs.defaultSpatial, v));
      }
    },
  });

  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() + keyboard.height.get() }],
  }));
  const scrim = useAnimatedStyle(() => {
    const h = height.get() || 1;
    return {
      opacity:
        MotionSpec.scrimOpacity * Math.max(0, Math.min(1, 1 - y.get() / h)),
    };
  });

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.scrim },
            scrim,
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityLabel="Close"
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            onLayout={onLayout}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surfaceContainerLow,
                paddingBottom: insets.bottom + 20,
              },
              sheet,
            ]}
          >
            <View
              style={[styles.handle, { backgroundColor: colors.outline }]}
            />
            {typeof children === "function" ? children(close) : children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
});
