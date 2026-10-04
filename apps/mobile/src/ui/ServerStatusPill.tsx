import { StyleSheet, Text, View } from 'react-native';

import type { ServerStatus } from '../server/status';

const COLORS: Record<ServerStatus, string> = {
  online: '#2e9e5b',
  offline: '#8a8a8a',
  unconfigured: '#8a8a8a',
  mismatch: '#d9a400',
};

const LABELS: Record<ServerStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  unconfigured: 'Sem servidor',
  mismatch: 'Outro servidor',
};

export function ServerStatusPill({ status }: { status: ServerStatus }) {
  return (
    <View style={[styles.pill, { backgroundColor: COLORS[status] }]}>
      <Text style={styles.text}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  text: { color: '#fff', fontSize: 12 },
});
