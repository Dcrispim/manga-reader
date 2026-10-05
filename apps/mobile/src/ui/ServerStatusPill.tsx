import { StyleSheet, View } from 'react-native';

import type { ServerStatus } from '../server/status';
import { Text } from './Text';
import { colors, radius } from './theme';

const DOT: Record<ServerStatus, string> = {
  online: colors.online,
  offline: colors.gray500,
  unconfigured: colors.gray500,
  mismatch: colors.warning,
};

const LABELS: Record<ServerStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  unconfigured: 'Sem servidor',
  mismatch: 'Outro servidor',
};

/** Same shape as the web's rounded-full chips: thin border, colored dot. */
export function ServerStatusPill({ status }: { status: ServerStatus }) {
  return (
    <View testID="status-pill" style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: DOT[status] }]} />
      <Text style={styles.text}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
});
