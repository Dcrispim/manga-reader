import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, radius } from './theme';

/** rounded-2xl bg-card border border-border, the web's panel. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** text-[10px] uppercase tracking-wider text-muted-foreground. */
export function Label({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

/** Rounded chip: genres, filters, small statuses. */
export function Chip({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'primary' | 'new' | 'dashed';
}) {
  return (
    <View style={[styles.chip, CHIP[tone].box]}>
      <Text style={[styles.chipText, CHIP[tone].text]}>{children}</Text>
    </View>
  );
}

const CHIP = {
  default: { box: { backgroundColor: colors.secondary }, text: { color: colors.foreground } },
  primary: {
    box: { borderColor: 'rgba(229,229,229,0.4)', backgroundColor: 'rgba(229,229,229,0.1)' },
    text: { color: colors.primary },
  },
  new: {
    box: { borderColor: 'rgba(254,154,0,0.4)', backgroundColor: 'rgba(254,154,0,0.1)' },
    text: { color: colors.newChapter },
  },
  dashed: { box: { borderStyle: 'dashed' as const }, text: { color: colors.mutedForeground } },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12 },
});
