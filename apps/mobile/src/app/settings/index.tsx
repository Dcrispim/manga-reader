import { Feather } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { db } from '../../db/client';
import { DEFAULTS, getSetting, setSetting } from '../../settings/repo';
import { testAddress } from '../../server/status';
import { refreshServer, useServerStatus } from '../../server/useServerStatus';
import { ServerStatusPill } from '../../ui/ServerStatusPill';
import { useCatalog } from '../../catalog/hooks';
import { settings } from '../../db/schema';
import { useLiveQuery } from '../../db/liveQuery';
import { formatRelative } from '../../settings/format';
import type { SyncResult } from '../../sync/bind';
import { CURSOR_KEY, type SyncOutcome } from '../../sync/catalog';
import { runCycle } from '../../sync/cycle';
import { adoptPendingServer, adoptServer, reloadCatalog } from '../../sync/serverSwitch';
import { describeBind, describeCatalog, lastRun } from '../../sync/syncStatus';
import { Button } from '../../ui/Button';
import { Card, Label } from '../../ui/Card';
import { common } from '../../ui/SettingsBits';
import { Text } from '../../ui/Text';
import { colors, radius } from '../../ui/theme';

const LINKS = [
  { href: '/settings/storage', label: 'Armazenamento', icon: 'hard-drive' },
  { href: '/settings/queue', label: 'Fila de downloads', icon: 'download' },
  { href: '/settings/bind', label: 'Sincronizar progresso', icon: 'refresh-cw' },
  { href: '/settings/metadata', label: 'Editar metadados de um título', icon: 'edit-3' },
  { href: '/settings/diagnostics', label: 'Diagnóstico', icon: 'activity' },
] as const;

function parsePort(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const n = parseInt(text, 10);
  return n >= 1 && n <= 65535 ? n : null;
}

export default function SettingsScreen() {
  const router = useRouter();
  const server = useServerStatus();
  const [host, setHost] = useState(getSetting(db, 'server.host') ?? '');
  const [port, setPort] = useState(
    getSetting(db, 'server.port') ?? DEFAULTS['server.port'],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [passed, setPassed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  // Server id of the last successful test, to spot an address of another server.
  const testedIdRef = useRef<string | null>(null);
  // Re-render whenever a setting changes (sync results, cursor, bind...).
  useLiveQuery(db.select().from(settings));
  const catalogCount = useCatalog().length;
  // Clock for the "há X min" texts, refreshed so they do not go stale.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  // "Manter" hides the banner until the status changes; the status itself
  // stays mismatch, so sync engines keep not running.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const savedId = getSetting(db, 'server.id');
  const portNum = parsePort(port);
  const hostValue = host.trim();
  const valid = hostValue.length > 0 && portNum !== null;

  async function onTest(): Promise<boolean> {
    if (!valid || portNum === null) {
      setMessage('Informe um host e uma porta entre 1 e 65535.');
      return false;
    }
    setBusy(true);
    setMessage('Testando...');
    const r = await testAddress(hostValue, portNum);
    setBusy(false);
    setPassed(r.ok);
    testedIdRef.current = r.ok ? r.serverId : null;
    setMessage(
      r.ok
        ? `Conectado — versão ${r.version}, ${r.ms} ms`
        : 'Não foi possível conectar',
    );
    return r.ok;
  }

  function persist() {
    if (portNum === null) return;
    // server.id is kept on purpose: if the new address turns out to be another
    // server, the next health check reports mismatch and the banner asks.
    setSetting(db, 'server.host', hostValue);
    setSetting(db, 'server.port', String(portNum));
    void refreshServer();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function onSave() {
    if (!valid) {
      setMessage('Informe um host e uma porta entre 1 e 65535.');
      return;
    }
    const ok = passed || (await onTest());
    if (ok) {
      const newId = testedIdRef.current;
      if (newId && savedId && newId !== savedId) {
        Alert.alert(
          'Trocar de servidor?',
          'Este endereço é de outro servidor. O catálogo (títulos, metadados e capas) será recarregado dele e o bind atual será desconectado. Downloads e o histórico deste aparelho ficam.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Trocar',
              onPress: () => {
                void adoptServer(db, newId).then(() => {
                  persist();
                  void runCycle({ mode: 'foreground' });
                });
              },
            },
          ],
        );
        return;
      }
      persist();
      return;
    }
    Alert.alert('Salvar mesmo assim?', 'Não foi possível conectar a este endereço.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salvar', onPress: persist },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={common.container}>
      <Card style={styles.card}>
        <View style={styles.headRow}>
          <Label>Servidor</Label>
          <ServerStatusPill status={server.status} />
        </View>
        {savedId ? <Text style={common.muted}>{`ID do servidor: ${savedId.slice(0, 8)}`}</Text> : null}

        {server.status === 'mismatch' && dismissedFor !== server.pendingServerId ? (
          <View style={styles.banner}>
            <Text>Este endereço aponta para outro servidor</Text>
            <Text style={common.muted}>
              Nada sincroniza até você escolher. Usar este servidor recarrega o catálogo dele e desconecta o bind.
            </Text>
            <View style={common.row}>
              <Button
                small
                label="Usar este servidor"
                onPress={() => {
                  void adoptPendingServer(db, server.pendingServerId)
                    .then(() => refreshServer())
                    .then(() => runCycle({ mode: 'foreground' }));
                }}
              />
              <Button small variant="outline" label="Manter" onPress={() => setDismissedFor(server.pendingServerId)} />
            </View>
          </View>
        ) : null}

        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Host</Text>
            <TextInput
              style={common.input}
              value={host}
              onChangeText={(t) => {
                setHost(t);
                setPassed(false);
              }}
              placeholder="192.168.0.10"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Host"
              testID="settings-host"
            />
          </View>
          <View style={[styles.field, styles.portField]}>
            <Text style={styles.fieldLabel}>Porta</Text>
            <TextInput
              style={common.input}
              value={port}
              onChangeText={(t) => {
                setPort(t);
                setPassed(false);
              }}
              keyboardType="numeric"
              accessibilityLabel="Porta"
              testID="settings-port"
            />
          </View>
        </View>

        {message ? <Text style={common.muted}>{message}</Text> : null}
        <View style={common.row}>
          <Button
            variant="outline"
            label="Testar conexão"
            disabled={busy}
            testID="settings-test"
            onPress={() => void onTest()}
          />
          <Button label="Salvar" disabled={busy} testID="settings-save" onPress={() => void onSave()} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Label>Sincronização</Label>
        <View style={styles.status}>
          <StatusLine
            label="Servidor"
            value={
              getSetting(db, 'server.host')
                ? `${getSetting(db, 'server.host')}:${getSetting(db, 'server.port')}${
                    savedId ? ` · ID ${savedId.slice(0, 8)}` : ''
                  }${getSetting(db, 'server.version') ? ` · v${getSetting(db, 'server.version')}` : ''}`
                : 'não configurado'
            }
          />
          <StatusLine
            label="Catálogo"
            value={`${catalogCount} títulos${
              Number(getSetting(db, CURSOR_KEY)) > 0
                ? ` · dados de ${formatRelative(Number(getSetting(db, CURSOR_KEY)), now)}`
                : ' · ainda não sincronizado'
            }`}
          />
          <RunLine label="Última atualização" now={now} run={lastRun<SyncOutcome>(db, 'catalog')} describe={describeCatalog} />
          <StatusLine label="Bind" value={getSetting(db, 'bind.code') || 'não conectado'} />
          <RunLine label="Último envio" now={now} run={lastRun<SyncResult>(db, 'bind')} describe={describeBind} />
        </View>
        {syncMessage ? <Text style={common.muted}>{syncMessage}</Text> : null}
        <View style={common.row}>
          <Button
            variant="outline"
            icon="refresh-cw"
            label={syncing ? 'Sincronizando...' : 'Sincronizar agora'}
            disabled={syncing}
            testID="settings-sync"
            onPress={() => {
              setSyncing(true);
              setSyncMessage(null);
              void runCycle({ mode: 'foreground' })
                .then((sum) =>
                  setSyncMessage(
                    sum.ran.includes('catalog')
                      ? 'Sincronização concluída.'
                      : 'Não sincronizou: verifique o status do servidor acima.',
                  ),
                )
                .finally(() => {
                  setSyncing(false);
                  setNow(Date.now());
                });
            }}
          />
          <Button
            variant="outline"
            icon="rotate-ccw"
            label="Recarregar catálogo do zero"
            disabled={syncing}
            onPress={() =>
              Alert.alert(
                'Recarregar o catálogo?',
                'Baixa de novo a lista de títulos, metadados e capas deste servidor e limpa o cache de imagens. Downloads e histórico ficam.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Recarregar',
                    onPress: () => {
                      setSyncing(true);
                      setSyncMessage(null);
                      void reloadCatalog(db)
                        .then((sum) =>
                          setSyncMessage(
                            sum.ran.includes('catalog')
                              ? 'Catálogo recarregado.'
                              : 'Não foi possível recarregar: verifique o status do servidor.',
                          ),
                        )
                        .finally(() => {
                          setSyncing(false);
                          setNow(Date.now());
                        });
                    },
                  },
                ],
              )
            }
          />
        </View>
      </Card>

      <Card style={styles.list}>
        {LINKS.map((l, i) => (
          <Link key={l.href} href={l.href} asChild>
            <Pressable
              accessibilityRole="link"
              // Flat object: Link's Slot loses array styles.
              style={StyleSheet.flatten([styles.item, i > 0 && styles.itemBorder])}
            >
              <Feather name={l.icon} size={16} color={colors.mutedForeground} />
              <Text style={styles.itemText}>{l.label}</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          </Link>
        ))}
      </Card>
    </ScrollView>
  );
}

function StatusLine({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <View style={styles.statusLine}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, tone === 'bad' && { color: colors.destructive }]}>{value}</Text>
    </View>
  );
}

function RunLine<T>({
  label,
  now,
  run,
  describe,
}: {
  label: string;
  now: number;
  run: { at: number; outcome: T } | null;
  describe: (o: T) => { ok: boolean; text: string };
}) {
  if (!run) return <StatusLine label={label} value="—" />;
  const d = describe(run.outcome);
  return <StatusLine label={label} value={`${formatRelative(run.at, now)} · ${d.text}`} tone={d.ok ? 'ok' : 'bad'} />;
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 14 },
  status: { gap: 8 },
  statusLine: { flexDirection: 'row', gap: 12 },
  statusLabel: { width: 130, fontSize: 13, color: colors.mutedForeground },
  statusValue: { flex: 1, fontSize: 13 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  banner: {
    padding: 12,
    borderRadius: radius.lg,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(240,177,0,0.4)',
    backgroundColor: 'rgba(240,177,0,0.1)',
  },
  fields: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 6 },
  portField: { flex: 0, width: 110 },
  fieldLabel: { fontSize: 12, color: colors.mutedForeground },
  list: { overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  itemBorder: { borderTopWidth: 1, borderColor: colors.borderSoft },
  itemText: { flex: 1, fontSize: 15 },
});
