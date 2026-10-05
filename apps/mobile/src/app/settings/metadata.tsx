import { Feather } from '@expo/vector-icons';
import Fuse from 'fuse.js';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useCatalog } from '../../catalog/hooks';
import type { CatalogTitle } from '../../catalog/queries';
import { db } from '../../db/client';
import { loadEntries, saveEntries, type Entry } from '../../metadata/api';
import { COMMON_FIELDS, COMMON_KEYS, customKeysError, type CustomRow } from '../../metadata/fields';
import { ThumbEditor } from '../../metadata/ThumbEditor';
import { useServerStatus } from '../../server/useServerStatus';
import { runCycle } from '../../sync/cycle';
import { Button, IconButton } from '../../ui/Button';
import { Card, Label } from '../../ui/Card';
import { displayName } from '../../ui/displayName';
import { common } from '../../ui/SettingsBits';
import { Text } from '../../ui/Text';
import { TitleCover } from '../../ui/TitleCover';
import { colors, fonts, radius } from '../../ui/theme';

const DEBOUNCE_MS = 150;
let nextRowId = 1;

/**
 * The web's metadata editor on the app: pick a title, edit the common fields
 * and custom key/values of .meta/<title>.metadata, and change its cover.
 * Writes go to the server, so it needs to be online.
 */
export default function MetadataScreen() {
  const catalog = useCatalog();
  const { status } = useServerStatus();
  const online = status === 'online';
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState<CatalogTitle | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingThumb, setEditingThumb] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  // Same local search as the app's search screen.
  const fuse = useMemo(
    () =>
      new Fuse(
        catalog.map((t) => ({
          t,
          name: t.name,
          author: t.meta.author ?? t.meta.authors ?? '',
          categories: t.categories.join(' '),
        })),
        { keys: ['name', 'author', 'categories'], threshold: 0.35, ignoreLocation: true },
      ),
    [catalog],
  );
  const results = useMemo(() => (query ? fuse.search(query).slice(0, 30).map((r) => r.item.t) : []), [fuse, query]);
  // The cover follows catalog updates (a saved cover arrives with the next sync).
  const current = title ? (catalog.find((t) => t.name === title.name) ?? title) : null;

  async function pick(t: CatalogTitle) {
    setTitle(t);
    setEditingThumb(false);
    setMessage(null);
    setLoading(true);
    const r = await loadEntries(db, t.name);
    setLoading(false);
    if (!r.ok) {
      setFields({});
      setCustom([]);
      setMessage({ ok: false, text: r.error });
      return;
    }
    const f: Record<string, string> = {};
    const rows: CustomRow[] = [];
    for (const [k, v] of r.value.entries ?? []) {
      if (COMMON_KEYS.has(k)) f[k] = v;
      else rows.push({ id: nextRowId++, key: k, value: v });
    }
    setFields(f);
    setCustom(rows);
  }

  async function save() {
    if (!title) return;
    const err = customKeysError(custom);
    if (err) {
      setMessage({ ok: false, text: err });
      return;
    }
    const entries: Entry[] = [
      ...COMMON_FIELDS.map((f) => [f.key, fields[f.key] ?? ''] as Entry),
      ...custom.map((r) => [r.key.trim(), r.value] as Entry),
    ];
    setSaving(true);
    setMessage(null);
    const r = await saveEntries(db, title.name, entries);
    setSaving(false);
    if (!r.ok) {
      setMessage({ ok: false, text: r.error });
      return;
    }
    setMessage({ ok: true, text: 'Metadados salvos.' });
    void runCycle({ mode: 'foreground' });
  }

  if (!title) {
    return (
      <View style={styles.root}>
        {!online ? (
          <Text style={styles.offline}>Sem conexão com o servidor: a edição precisa dele.</Text>
        ) : null}
        <View style={styles.field}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Buscar por título, gênero ou autor..."
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            style={styles.searchInput}
          />
        </View>
        <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled">
          {query && results.length === 0 ? <Text style={styles.none}>Nenhum título encontrado.</Text> : null}
          {results.map((t) => (
            <Pressable key={t.name} accessibilityRole="button" onPress={() => void pick(t)} style={styles.result}>
              <View style={styles.resultCover}>
                <TitleCover name={t.name} thumbPath={t.thumbPath} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {displayName(t.name)}
                </Text>
                <Text style={common.muted} numberOfLines={1}>
                  {`${t.caps} capítulos${t.meta.author ? ` · ${t.meta.author}` : ''}`}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={common.container} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <View style={styles.head}>
          <View style={styles.headCover}>
            <TitleCover name={current!.name} thumbPath={current!.thumbPath} />
          </View>
          <View style={styles.headInfo}>
            <Text style={styles.headName}>{displayName(title.name)}</Text>
            <Text style={common.muted}>{`.meta/${title.name}.metadata`}</Text>
            <View style={common.row}>
              {!editingThumb ? (
                <Button
                  small
                  variant="outline"
                  icon="image"
                  label="Trocar capa"
                  disabled={!online}
                  onPress={() => {
                    setMessage(null);
                    setEditingThumb(true);
                  }}
                />
              ) : null}
              <Button small variant="ghost" icon="arrow-left" label="Outro título" onPress={() => setTitle(null)} />
            </View>
          </View>
        </View>
      </Card>

      {editingThumb ? (
        <Card style={styles.card}>
          <Label>Trocar capa</Label>
          <ThumbEditor
            title={title.name}
            onCancel={() => setEditingThumb(false)}
            onSaved={() => {
              setEditingThumb(false);
              setMessage({ ok: true, text: 'Capa salva. Ela aparece no catálogo após a sincronização.' });
              void runCycle({ mode: 'foreground' });
            }}
          />
        </Card>
      ) : loading ? (
        <ActivityIndicator color={colors.mutedForeground} />
      ) : (
        <>
          <Card style={styles.card}>
            {COMMON_FIELDS.map((f) => (
              <View key={f.key} style={styles.fieldBlock}>
                <Label>{`${f.label} (${f.key})`}</Label>
                <TextInput
                  value={fields[f.key] ?? ''}
                  onChangeText={(v) => setFields((s) => ({ ...s, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  multiline={f.multiline}
                  style={[common.input, f.multiline && styles.multiline]}
                />
              </View>
            ))}
          </Card>

          <Card style={styles.card}>
            <Label>Campos personalizados</Label>
            {custom.length === 0 ? <Text style={styles.none}>Nenhum campo personalizado.</Text> : null}
            {custom.map((r) => (
              <View key={r.id} style={styles.customRow}>
                <TextInput
                  value={r.key}
                  onChangeText={(v) => setCustom((rows) => rows.map((x) => (x.id === r.id ? { ...x, key: v } : x)))}
                  placeholder="chave"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[common.input, styles.customKey]}
                />
                <TextInput
                  value={r.value}
                  onChangeText={(v) => setCustom((rows) => rows.map((x) => (x.id === r.id ? { ...x, value: v } : x)))}
                  placeholder="valor"
                  placeholderTextColor={colors.mutedForeground}
                  style={[common.input, { flex: 1 }]}
                />
                <IconButton
                  icon="trash-2"
                  label={`Remover ${r.key || 'campo'}`}
                  onPress={() => setCustom((rows) => rows.filter((x) => x.id !== r.id))}
                />
              </View>
            ))}
            <View style={common.row}>
              <Button
                small
                variant="outline"
                icon="plus"
                label="Adicionar campo"
                onPress={() => setCustom((rows) => [...rows, { id: nextRowId++, key: '', value: '' }])}
              />
            </View>
            <Text style={common.muted}>
              Campos vazios não são gravados. Quebras de linha viram espaço (o arquivo guarda um valor por linha).
            </Text>
          </Card>
        </>
      )}

      {message ? <Text style={message.ok ? styles.ok : styles.error}>{message.text}</Text> : null}

      {!editingThumb && !loading ? (
        <View style={styles.actions}>
          <Button label={saving ? 'Salvando...' : 'Salvar'} disabled={saving || !online} onPress={() => void save()} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  offline: { margin: 16, marginBottom: 0, fontSize: 13, color: colors.warning },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, paddingVertical: 12, color: colors.foreground, fontFamily: fonts.regular, fontSize: 15 },
  results: { paddingHorizontal: 16, paddingBottom: 32, gap: 4 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  resultCover: { width: 40 },
  resultName: { fontSize: 15, fontWeight: '500' },
  none: { fontSize: 13, fontStyle: 'italic', color: colors.mutedForeground },
  card: { padding: 16, gap: 14 },
  head: { flexDirection: 'row', gap: 16 },
  headCover: { width: 88 },
  headInfo: { flex: 1, gap: 6 },
  headName: { fontSize: 20, fontWeight: '700' },
  fieldBlock: { gap: 6 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customKey: { width: 120, fontSize: 12 },
  ok: { fontSize: 13, color: colors.online },
  error: { fontSize: 13, color: colors.destructive },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
