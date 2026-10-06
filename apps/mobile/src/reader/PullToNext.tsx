import { Feather } from '@expo/vector-icons';
import { useState, type MutableRefObject, type ReactNode } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Reanimated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '../ui/Text';
import { colors } from '../ui/theme';

// Displayed pull (after the rubber curve) that triggers the next chapter, and
// the most the content can be pulled. With these, the finger has to travel
// about 320 dp past the end of the list, so a casual swipe never triggers.
const THRESHOLD = 190;
const MAX_PULL = 280;

/**
 * Pull-up-to-continue at the end of a chapter: once the list is at its end,
 * dragging further up stretches the content like a rubber band and shows
 * where it leads; letting go past the threshold opens the next chapter,
 * otherwise it springs back. The list keeps its native scroll throughout.
 */
export function usePullToNext({
  next,
  onNext,
  enabled = true,
}: {
  next: string | null;
  onNext: () => void;
  /** Off in Settings: no gesture at all, the list just ends at the strip. */
  enabled?: boolean;
}) {
  const atEnd = useSharedValue(false);
  const pull = useSharedValue(0);
  // translationY when the drag reached the end of the list (the part of a
  // drag spent scrolling does not count as pull).
  const base = useSharedValue<number | null>(null);
  const canGo = next !== null;
  // The list (react-native-gesture-handler's FlatList) names this ref in
  // simultaneousHandlers, so the pull and the native scroll run together:
  // a plain Pan would steal the scroll, and passive touch events get
  // cancelled by the ScrollView as soon as it intercepts the drag.
  const [panRef] = useState<MutableRefObject<GestureType | undefined>>(() => ({ current: undefined }));

  const pan = Gesture.Pan()
    .enabled(enabled)
    .withRef(panRef)
    .activeOffsetY(-6)
    .failOffsetX([-24, 24])
    .maxPointers(1)
    .onStart(() => {
      base.value = null;
    })
    .onUpdate((e) => {
      if (!atEnd.value) {
        base.value = null;
        pull.value = 0;
        return;
      }
      if (base.value === null) base.value = e.translationY;
      const up = base.value - e.translationY;
      // Rubber band: easy at first, ever stiffer, never past MAX_PULL.
      pull.value = up > 0 ? MAX_PULL * (1 - Math.exp(-up / MAX_PULL)) : 0;
    })
    .onFinalize(() => {
      if (canGo && pull.value >= THRESHOLD) runOnJS(onNext)();
      pull.value = withSpring(0, { damping: 18, stiffness: 180 });
      base.value = null;
    });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    atEnd.value = contentOffset.y + layoutMeasurement.height >= contentSize.height - 4;
  };

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -pull.value }] }));

  return { pan, panRef, contentStyle, onScroll, pull };
}

/**
 * The list wrapper that detects the pull and moves with it. A plain
 * component (not created in the hook) so the list is not remounted.
 */
export function PullToNextArea({
  pan,
  contentStyle,
  children,
}: Pick<ReturnType<typeof usePullToNext>, 'pan' | 'contentStyle'> & { children: ReactNode }) {
  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={[styles.fill, contentStyle]}>{children}</Reanimated.View>
    </GestureDetector>
  );
}

/** What the pull leads to, revealed under the stretched content. */
export function PullIndicator({
  pull,
  next,
  bottom,
}: {
  pull: SharedValue<number>;
  next: string | null;
  bottom: number;
}) {
  const boxStyle = useAnimatedStyle(() => ({
    height: pull.value,
    opacity: interpolate(pull.value, [0, 30], [0, 1], Extrapolation.CLAMP),
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: pull.value >= THRESHOLD ? '180deg' : '0deg' }],
  }));
  const pullStyle = useAnimatedStyle(() => ({ opacity: pull.value >= THRESHOLD ? 0 : 1 }));
  const releaseStyle = useAnimatedStyle(() => ({ opacity: pull.value >= THRESHOLD ? 1 : 0 }));
  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, (pull.value / THRESHOLD) * 100)}%`,
    backgroundColor: pull.value >= THRESHOLD ? colors.primary : colors.mutedForeground,
  }));

  return (
    <Reanimated.View pointerEvents="none" style={[styles.indicator, { bottom }, boxStyle]}>
      <View style={styles.inner}>
        {next ? (
          <>
            <Reanimated.View style={arrowStyle}>
              <Feather name="arrow-up" size={22} color={colors.foreground} />
            </Reanimated.View>
            <View style={styles.labels}>
              <Reanimated.Text style={[styles.label, pullStyle]}>{`Puxe para o capítulo ${next}`}</Reanimated.Text>
              <Reanimated.Text style={[styles.label, styles.release, releaseStyle]}>
                {`Solte para ir ao capítulo ${next}`}
              </Reanimated.Text>
            </View>
            <View style={styles.track}>
              <Reanimated.View style={[styles.bar, barStyle]} />
            </View>
          </>
        ) : (
          <Text style={styles.label}>Este é o último capítulo</Text>
        )}
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  indicator: { position: 'absolute', left: 0, right: 0, overflow: 'hidden', justifyContent: 'center' },
  inner: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  labels: { height: 22, alignSelf: 'stretch' },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 15,
    color: colors.foreground,
    fontFamily: 'Geist_500Medium',
  },
  release: { fontFamily: 'Geist_600SemiBold' },
  track: { width: 120, height: 3, borderRadius: 2, backgroundColor: colors.secondary, overflow: 'hidden' },
  bar: { height: 3 },
});
