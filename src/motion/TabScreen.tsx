import { type ComponentRef, forwardRef } from 'react';
import { Animated } from 'react-native';
import { InnerScreen, type ScreenProps } from 'react-native-screens';

/**
 * Stand-in for react-native-screens' Screen inside the tab navigator (provided through
 * ScreenContext in the tabs layout).
 *
 * The tabs keep inactive screens attached so a swipe can show the neighbouring tab
 * (`detachInactiveScreens={false}`). Without native detaching, react-native-screens falls back
 * to a plain view that sets `display: 'none'` on every inactive screen, so each tab change
 * re-lays out a whole tab tree on the way in and another on the way out (32ms after the
 * transition), stalling the UI thread right when the nav bar is tapped. It also hides the
 * neighbour a swipe is meant to reveal.
 *
 * Here an inactive tab stays laid out: the fade-through already makes it transparent (alpha 0
 * is skipped when drawing), and it ignores touches. Screens that do use native detaching go
 * to the stock implementation.
 */
export const TabScreen = forwardRef<ComponentRef<typeof InnerScreen>, ScreenProps>(function TabScreen(props, ref) {
  if (props.enabled !== false) return <InnerScreen {...props} ref={ref} />;
  const {
    active,
    activityState,
    style,
    children,
    // Native-only Screen props that a plain view must not get.
    enabled: _enabled,
    freezeOnBlur: _freeze,
    onComponentRef: _onRef,
    ...rest
  } = props;
  const state = activityState ?? (active !== undefined && active !== 0 ? 2 : 0);
  return (
    <Animated.View
      {...(rest as object)}
      ref={ref as any}
      style={style}
      pointerEvents={state === 0 ? 'none' : 'auto'}
    >
      {children}
    </Animated.View>
  );
});
