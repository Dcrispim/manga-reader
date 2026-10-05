import { useLiveQuery } from '../../db/liveQuery';
import { inArray } from 'drizzle-orm';
import { ScrollView, View } from 'react-native';

import { db } from '../../db/client';
import { jobs } from '../../db/schema';
import { cancel } from '../../jobs/repo';
import { jobLabel } from '../../settings/jobLabel';
import { Button, common } from '../../ui/SettingsBits';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';

export default function QueueScreen() {
  const { data } = useLiveQuery(
    db.select().from(jobs).where(inArray(jobs.state, ['queued', 'running', 'paused', 'failed'])),
  );
  const rows = data ?? [];
  return (
    <ScrollView contentContainerStyle={common.container}>
      {rows.length === 0 ? <Text style={common.muted}>Nenhum download na fila.</Text> : null}
      {rows.map((j) => (
        <Card key={j.id} style={{ padding: 16, gap: 10 }}>
          <Text style={{ fontWeight: '600' }}>
            {`${j.title} — cap. ${j.chapter}${j.kind === 'upgrade' ? ' (alta resolução)' : ''}`}
          </Text>
          <Text style={common.muted}>{jobLabel(j)}</Text>
          <View style={common.row}>
            <Button label="Cancelar" danger onPress={() => cancel(db, j.id)} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
