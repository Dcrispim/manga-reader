import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from '../../db/liveQuery';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { db } from '../../db/client';
import { diagLog } from '../../db/schema';
import { exportLog } from '../../diag/export';
import { formatClock } from '../../settings/format';
import { Button, common } from '../../ui/SettingsBits';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { colors, radius } from '../../ui/theme';

const LEVELS = ['todos', 'info', 'warn', 'error'] as const;

export default function DiagnosticsScreen() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('todos');
  const [message, setMessage] = useState<string | null>(null);
  const base = db.select().from(diagLog);
  const { data } = useLiveQuery(
    (level === 'todos' ? base : base.where(eq(diagLog.level, level)))
      .orderBy(desc(diagLog.id))
      .limit(200),
    [level],
  );
  const rows = data ?? [];

  async function onExport() {
    // Export is always the unfiltered tail, oldest first.
    const all = db.select().from(diagLog).orderBy(desc(diagLog.id)).limit(200).all().reverse();
    const ok = await exportLog(all);
    setMessage(ok ? null : 'Não foi possível exportar o log.');
  }

  return (
    <ScrollView contentContainerStyle={common.container}>
      <View style={common.row}>
        {LEVELS.map((l) => (
          <Pressable
            key={l}
            accessibilityRole="button"
            onPress={() => setLevel(l)}
            style={[styles.chip, l === level && styles.chipOn]}
          >
            <Text style={[styles.chipText, l === level && styles.chipTextOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <View style={common.row}>
        <Button label="Exportar" onPress={() => void onExport()} />
        <Button
          label="Limpar"
          danger
          onPress={() => {
            db.delete(diagLog).run();
            setMessage(null);
          }}
        />
      </View>
      {message ? <Text style={common.muted}>{message}</Text> : null}
      <Card style={styles.log}>
        {rows.length === 0 ? <Text style={common.muted}>Nenhuma entrada.</Text> : null}
        {rows.map((r) => (
          <Text key={r.id} style={[styles.line, r.level === 'error' && styles.lineError]}>
            {`${formatClock(r.at)} [${r.level}] ${r.scope}: ${r.message}`}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: 'rgba(229,229,229,0.1)' },
  chipText: { fontSize: 12, color: colors.mutedForeground },
  chipTextOn: { color: colors.primary },
  log: { padding: 12, gap: 4 },
  line: { fontSize: 12, color: colors.mutedForeground },
  lineError: { color: colors.destructive },
});
