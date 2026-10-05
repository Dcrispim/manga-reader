import { StyleSheet, View } from 'react-native';

import { hashName } from '../catalog/hash';
import { Text } from './Text';

/** Stable hue per title name (same hash as the cover file names). */
export function placeholderColor(name: string): string {
  const hue = parseInt(hashName(name), 16) % 360;
  return `hsl(${hue}, 30%, 22%)`;
}

/** Up to two initials from the first words of the name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? '');
  return letters.join('').toUpperCase() || '?';
}

export function Placeholder({ name }: { name: string }) {
  return (
    <View style={[styles.box, { backgroundColor: placeholderColor(name) }]}>
      <Text style={styles.text}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 28, fontWeight: '700' },
});
