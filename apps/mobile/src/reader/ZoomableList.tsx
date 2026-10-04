import { useState, type ReactNode } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { clampScale, clampTranslateX, doubleTapScale } from './zoom';

/**
 * Pinch and double-tap zoom applied to the whole list container (not per page,
 * which is unstable inside a FlatList). Vertical movement stays with the list's
 * own scroll; only a horizontal pan is added, and only while zoomed.
 */
export function ZoomableList({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const w = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .withTestId('pinch')
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = clampScale(savedScale.value * e.scale);
      tx.value = clampTranslateX(tx.value, scale.value, w.value);
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
      }
    });

  const pan = Gesture.Pan()
    .withTestId('pan')
    .minPointers(1)
    .maxPointers(1)
    // Let the list own vertical drags; claim only clear horizontal ones.
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      savedTx.value = tx.value;
    })
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      tx.value = clampTranslateX(savedTx.value + e.translationX, scale.value, w.value);
    });

  const doubleTap = Gesture.Tap()
    .withTestId('doubleTap')
    .numberOfTaps(2)
    .onEnd((_e, success) => {
      if (!success) return;
      const target = doubleTapScale(scale.value);
      scale.value = withTiming(target);
      if (target === 1) tx.value = withTiming(0);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { scale: scale.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    w.value = e.nativeEvent.layout.width;
  };

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View
        style={[styles.fill, style]}
        onLayout={onLayout}
        accessibilityLabel={`zoom-${Math.round(width)}`}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
