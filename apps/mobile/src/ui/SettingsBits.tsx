import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button as PillButton } from './Button';
import { Card, Label } from './Card';
import { Text } from './Text';
import { colors, radius } from './theme';

export function Button({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <PillButton
      label={label}
      onPress={onPress}
      disabled={disabled}
      variant={danger ? 'danger' : 'primary'}
    />
  );
}

/** A settings group: a web-style card with a small uppercase heading. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={styles.section}>
      <Label>{title}</Label>
      {children}
    </Card>
  );
}

/** Usage bar like the title page progress: h-1.5 track, primary fill. */
export function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={styles.barBlock}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${pct * 100}%` }, pct >= 1 && styles.barFull]}
        />
      </View>
    </View>
  );
}

export const common = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  input: {
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.foreground,
    backgroundColor: 'rgba(255,255,255,0.03)',
    fontFamily: 'Geist_400Regular',
    fontSize: 14,
  },
  muted: { color: colors.mutedForeground, fontSize: 13 },
  link: { color: colors.foreground, fontSize: 15, paddingVertical: 6 },
  error: { color: colors.destructive },
});

const styles = StyleSheet.create({
  section: { padding: 16, gap: 12 },
  barBlock: { gap: 6 },
  barLabel: { fontSize: 13, color: colors.mutedForeground },
  barTrack: { height: 6, borderRadius: radius.full, backgroundColor: colors.secondary, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.primary },
  barFull: { backgroundColor: colors.newChapter },
});
