import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { inArray } from 'drizzle-orm';
import { ScrollView, Text, View } from 'react-native';

import { db } from '../../db/client';
import { jobs } from '../../db/schema';
import { cancel } from '../../jobs/repo';
import { jobLabel } from '../../settings/jobLabel';
import { Button, common } from '../../ui/SettingsBits';

export default function QueueScreen() {
  const { data } = useLiveQuery(
    db.select().from(jobs).where(inArray(jobs.state, ['queued', 'running', 'paused', 'failed'])),
  );
  const rows = data ?? [];
  return (
    <ScrollView contentContainerStyle={common.container}>
      <Text style={common.title}>Fila de downloads</Text>
      {rows.length === 0 ? <Text style={common.muted}>Nenhum download na fila.</Text> : null}
      {rows.map((j) => (
        <View key={j.id} style={{ gap: 6, paddingVertical: 6 }}>
          <Text>{`${j.title} — cap. ${j.chapter}${j.kind === 'upgrade' ? ' (alta resolução)' : ''}`}</Text>
          <Text style={common.muted}>{jobLabel(j)}</Text>
          <Button label="Cancelar" danger onPress={() => cancel(db, j.id)} />
        </View>
      ))}
    </ScrollView>
  );
}
