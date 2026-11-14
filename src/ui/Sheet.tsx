import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  BackHandler,
  Keyboard,
  type LayoutChangeEvent,
  Pressable,
  type ScrollViewProps,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  GestureDetector,
  type PanGesture,
  ScrollView as GHScrollView,
  usePanGesture,
} from "react-native-gesture-handler";
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
  /**
   * Only an explicit action closes it (its buttons, Back): scrim taps just hide the keyboard
   * and a drag down springs back. For forms where an accidental close loses typing.
   */
  persistent?: boolean;
};

/** Fraction of the sheet height past which a release dismisses it. */
const DISMISS_FRACTION = 0.35;
/** Downward fling velocity (dp/s) that dismisses regardless of distance. */
const DISMISS_VELOCITY = 900;
/** Tallest the sheet may get, as a fraction of the window below the status bar. */
const MAX_HEIGHT_FRACTION = 0.85;

/** The sheet's drag-to-dismiss pan, so a scrolling body can claim vertical drags first. */
const SheetPanContext = createContext<PanGesture | null>(null);

/**
 * Modal bottom sheet (design: Capture). Mounting opens it: it springs up from below on
 * defaultSpatial. It follows the finger 1:1, rubber-bands when pulled up, and on release
 * either springs back (defaultSpatial) or dismisses (fastSpatial) carrying the fling
 * velocity. The scrim fades with the sheet's position; the keyboard pushes it up frame by
 * frame. Back and scrim taps dismiss with the same animation. Renders in the root portal,
 * so it always sits above the whole screen wherever it is written.
 *
 * The sheet sizes to its content up to ~85% of the window; taller content must put its
 * long part in a `SheetScrollView`, which shrinks to fit and scrolls. Drags on that list
 * scroll it; drags anywhere else (handle, title, buttons) still move the sheet.
 */
export function Sheet({ onDismiss, children, accessibilityLabel, persistent = false }: Props) {
  const colors = useColors();
  const springs = useSprings();
  const insets = useSafeAreaInsets();
  const keyboard = useReanimatedKeyboardAnimation();
  const win = useWindowDimensions();
  const maxHeight = (win.height - insets.top) * MAX_HEIGHT_FRACTION;

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
        !persistent &&
        (v > DISMISS_VELOCITY ||
          (y.get() > height.get() * DISMISS_FRACTION && v > -200))
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
    // The keyboard lifts the sheet (height is <= 0), so shrink the cap by as much to keep
    // the top on screen.
    maxHeight: maxHeight + keyboard.height.get(),
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
            onPress={() => {
              // With the keyboard up, a tap outside only puts it away.
              if (Keyboard.isVisible()) Keyboard.dismiss();
              else if (!persistent) close();
            }}
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
            <SheetPanContext value={pan}>
              <View style={styles.body}>
                {typeof children === "function" ? children(close) : children}
              </View>
            </SheetPanContext>
          </Animated.View>
        </GestureDetector>
      </View>
    </Portal>
  );
}

/**
 * Scrollable part of a `Sheet`'s content. It sizes to its content and shrinks (then
 * scrolls) once the sheet hits its max height. Every ancestor between it and the sheet
 * needs `flexShrink: 1` so the squeeze reaches it. While it can scroll, it claims vertical
 * drags before the sheet's dismiss pan; when it fits, it is inert and the sheet drags as usual.
 */
export function SheetScrollView({
  style,
  onLayout,
  onContentSizeChange,
  ...rest
}: ScrollViewProps) {
  const pan = useContext(SheetPanContext);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const scrolls = content > viewport + 1;
  return (
    <GHScrollView
      {...rest}
      block={scrolls && pan ? pan : undefined}
      scrollEnabled={scrolls}
      style={[styles.scroll, style]}
      onLayout={(e) => {
        setViewport(e.nativeEvent.layout.height);
        onLayout?.(e);
      }}
      onContentSizeChange={(w, h) => {
        setContent(h);
        onContentSizeChange?.(w, h);
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: {
    flexShrink: 1,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
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
