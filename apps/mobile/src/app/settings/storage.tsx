import { sql } from 'drizzle-orm';
import { useLiveQuery } from '../../db/liveQuery';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, TextInput, View } from 'react-native';

import { db } from '../../db/client';
import { downloads, transientPages } from '../../db/schema';
import { formatBytes } from '../../settings/format';
import { clearCatalog, thumbsDir } from '../../settings/catalogReset';
import {
  applyLimit,
  getLimit,
  LIMIT_FIELDS,
  limitToText,
  parseLimit,
  type LimitField,
} from '../../settings/limits';
import { getSetting, setSetting } from '../../settings/repo';
import { deleteAll, deleteTitle } from '../../storage/downloads';
import { expoFileStore } from '../../storage/files';
import { clearTransient } from '../../storage/transient';
import { Bar, Button, Section, common } from '../../ui/SettingsBits';
import { Text } from '../../ui/Text';
import { colors } from '../../ui/theme';

function LimitEditor({ field, onSaved }: { field: LimitField; onSaved: () => void }) {
  const [text, setText] = useState(limitToText(field.key, getLimit(db, field.key)));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const r = parseLimit(field.key, text);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    await applyLimit(db, expoFileStore, field.key, r.value);
    setText(limitToText(field.key, r.value));
    onSaved();
  }

  return (
    <View style={{ gap: 4 }}>
      <Text style={common.muted}>{field.label}</Text>
      <View style={common.row}>
        <TextInput
          style={[common.input, { flex: 1 }]}
          value={text}
          onChangeText={setText}
          keyboardType="numeric"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={field.label}
        />
        <Button label="Aplicar" onPress={() => void save()} />
      </View>
      {error ? <Text style={common.error}>{error}</Text> : null}
    </View>
  );
}

function Toggle({ label, settingKey }: { label: string; settingKey: string }) {
  const [on, setOn] = useState(getSetting(db, settingKey) === 'true');
  return (
    <View style={common.row}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={on}
        trackColor={{ false: colors.secondary, true: 'rgba(229,229,229,0.45)' }}
        thumbColor={on ? colors.primary : colors.mutedForeground}
        onValueChange={(v) => {
          setOn(v);
          setSetting(db, settingKey, v ? 'true' : 'false');
        }}
      />
    </View>
  );
}

export default function StorageScreen() {
  const { data: perTitle } = useLiveQuery(
    db
      .select({
        title: downloads.title,
        chapters: sql<number>`count(*)`,
        bytes: sql<number>`coalesce(sum(${downloads.bytes}), 0)`,
      })
      .from(downloads)
      .groupBy(downloads.title)
      .orderBy(downloads.title),
  );
  const { data: transient } = useLiveQuery(
    db.select({ bytes: sql<number>`coalesce(sum(${transientPages.bytes}), 0)` }).from(transientPages),
  );
  // Bumped after edits so limits (read from settings, not live) are re-read.
  const [version, setVersion] = useState(0);
  const [coversBytes, setCoversBytes] = useState(0);
  const [freeBytes, setFreeBytes] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [c, f] = await Promise.all([
        expoFileStore.size(thumbsDir(expoFileStore)),
        expoFileStore.freeDiskBytes(),
      ]);
      if (alive) {
        setCoversBytes(c);
        setFreeBytes(f);
      }
    })();
    return () => {
      alive = false;
    };
  }, [version, perTitle, transient]);

  const rows = perTitle ?? [];
  const chapters = rows.reduce((n, r) => n + Number(r.chapters), 0);
  const bytes = rows.reduce((n, r) => n + Number(r.bytes), 0);
  const transientBytes = Number(transient?.[0]?.bytes ?? 0);
  const maxGlobal = getLimit(db, 'space.maxGlobal');
  const maxBytes = getLimit(db, 'space.maxBytes');
  const transientMax = getLimit(db, 'space.transientMaxBytes');
  void version;

  function confirm(title: string, body: string, action: () => Promise<void>) {
    Alert.alert(title, body, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: () => {
          void action().then(() => setVersion((v) => v + 1));
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={common.container}>

      <Section title="Uso">
        <Bar
          label={`Downloads: ${chapters} de ${maxGlobal} capítulos`}
          value={chapters}
          max={maxGlobal}
        />
        <Bar
          label={`Downloads: ${formatBytes(bytes)} de ${formatBytes(maxBytes)}`}
          value={bytes}
          max={maxBytes}
        />
        <Bar
          label={`Cache de leitura: ${formatBytes(transientBytes)} de ${formatBytes(transientMax)}`}
          value={transientBytes}
          max={transientMax}
        />
        <Text style={common.muted}>{`Capas do catálogo: ${formatBytes(coversBytes)}`}</Text>
        <Text style={common.muted}>{`Espaço livre no aparelho: ${formatBytes(freeBytes)}`}</Text>
      </Section>

      <Section title="Limites">
        {LIMIT_FIELDS.map((f) => (
          <LimitEditor key={f.key} field={f} onSaved={() => setVersion((v) => v + 1)} />
        ))}
      </Section>

      <Section title="Downloads">
        <Toggle label="Baixar em alta resolução" settingKey="downloads.highRes" />
      </Section>

      <Section title="Títulos baixados">
        {rows.length === 0 ? <Text style={common.muted}>Nenhum download.</Text> : null}
        {rows.map((r) => (
          <View key={r.title} style={common.row}>
            <Text style={{ flex: 1 }}>{`${r.title} — ${r.chapters} cap., ${formatBytes(Number(r.bytes))}`}</Text>
            <Button
              label="Remover"
              danger
              onPress={() =>
                confirm('Remover downloads', r.title, () => deleteTitle(db, expoFileStore, r.title))
              }
            />
          </View>
        ))}
      </Section>

      <Section title="Limpeza">
        <Button
          label="Remover todos os downloads"
          danger
          onPress={() =>
            confirm('Remover todos os downloads?', 'Os capítulos baixados serão apagados.', () =>
              deleteAll(db, expoFileStore),
            )
          }
        />
        <Button
          label="Limpar cache de leitura"
          onPress={() => {
            void clearTransient(db, expoFileStore).then(() => {
              setMessage('Cache de leitura limpo.');
              setVersion((v) => v + 1);
            });
          }}
        />
        <Button
          label="Limpar catálogo"
          danger
          onPress={() =>
            confirm(
              'Limpar catálogo?',
              'O catálogo será baixado de novo na próxima sincronização. Downloads e histórico são mantidos.',
              () => clearCatalog(db, expoFileStore),
            )
          }
        />
        {message ? <Text style={common.muted}>{message}</Text> : null}
      </Section>
    </ScrollView>
  );
}
