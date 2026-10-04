import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { db } from '../../db/client';
import { diagLog } from '../../db/schema';
import { exportLog } from '../../diag/export';
import { formatClock } from '../../settings/format';
import { Button, common } from '../../ui/SettingsBits';

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
      <Text style={common.title}>Diagnóstico</Text>
      <View style={common.row}>
        {LEVELS.map((l) => (
          <Pressable key={l} accessibilityRole="button" onPress={() => setLevel(l)}>
            <Text style={[common.link, l === level && { fontWeight: '700' }]}>{l}</Text>
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
      {message ? <Text>{message}</Text> : null}
      {rows.length === 0 ? <Text style={common.muted}>Nenhuma entrada.</Text> : null}
      {rows.map((r) => (
        <Text key={r.id} style={{ fontSize: 12 }}>
          {`${formatClock(r.at)} [${r.level}] ${r.scope}: ${r.message}`}
        </Text>
      ))}
    </ScrollView>
  );
}
