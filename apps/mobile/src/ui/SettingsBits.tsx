import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, danger && styles.danger, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={styles.barBlock}>
      <Text>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${pct * 100}%` }, pct >= 1 && styles.barFull]}
        />
      </View>
    </View>
  );
}

export const common = StyleSheet.create({
  container: { padding: 24, gap: 10 },
  title: { fontSize: 22, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 6, padding: 8 },
  muted: { color: '#666' },
  link: { color: '#208AEF', fontSize: 16, paddingVertical: 6 },
  error: { color: '#b00020' },
});

const styles = StyleSheet.create({
  button: { backgroundColor: '#208AEF', padding: 12, borderRadius: 6, alignItems: 'center' },
  danger: { backgroundColor: '#b00020' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff' },
  section: { gap: 8, marginTop: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
  barBlock: { gap: 4 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#ddd', overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#208AEF' },
  barFull: { backgroundColor: '#e07b00' },
});
