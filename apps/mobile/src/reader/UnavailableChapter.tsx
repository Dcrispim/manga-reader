import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import type { Job } from '../jobs/repo';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { colors } from '../ui/theme';

interface Props {
  job: Job | null;
  onDownload: () => void;
  onBack: () => void;
}

/** Shown when no origin can serve the chapter (offline and never saved). */
export function UnavailableChapter({ job, onDownload, onBack }: Props) {
  const active = job && ['queued', 'running', 'paused'].includes(job.state);
  return (
    <View style={styles.box}>
      <Card style={styles.card}>
        <Feather name="wifi-off" size={28} color={colors.mutedForeground} />
        <Text style={styles.title}>Este capítulo não está disponível offline</Text>
        {active ? (
          <Text style={styles.progress}>
            {job.pagesTotal
              ? `Na fila de download: ${job.pagesDone}/${job.pagesTotal} páginas`
              : 'Na fila de download'}
          </Text>
        ) : (
          <Button label="Baixar quando disponível" icon="download" onPress={onDownload} />
        )}
        <Button label="Voltar" variant="ghost" onPress={onBack} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { alignItems: 'center', gap: 16, padding: 28, maxWidth: 420, width: '100%' },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  progress: { fontSize: 14, color: colors.mutedForeground },
});
