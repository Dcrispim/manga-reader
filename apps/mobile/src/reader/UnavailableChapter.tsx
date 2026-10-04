import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Job } from '../jobs/repo';

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
      <Text style={styles.title}>Este capítulo não está disponível offline</Text>
      {active ? (
        <Text style={styles.progress}>
          {job.pagesTotal
            ? `Na fila de download: ${job.pagesDone}/${job.pagesTotal} páginas`
            : 'Na fila de download'}
        </Text>
      ) : (
        <Pressable accessibilityRole="button" onPress={onDownload} style={styles.primary}>
          <Text style={styles.primaryText}>Baixar quando disponível</Text>
        </Pressable>
      )}
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.secondary}>
        <Text style={styles.link}>Voltar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 16, textAlign: 'center' },
  progress: { fontSize: 14, color: '#2e7d4f' },
  primary: { backgroundColor: '#1b6fe0', borderRadius: 6, paddingHorizontal: 16, paddingVertical: 10 },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { paddingVertical: 8 },
  link: { color: '#1b6fe0', fontSize: 15 },
});
