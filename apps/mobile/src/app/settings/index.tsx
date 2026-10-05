import { Feather } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { db } from '../../db/client';
import { DEFAULTS, getSetting, setSetting } from '../../settings/repo';
import { acceptPendingServer, testAddress } from '../../server/status';
import { refreshServer, useServerStatus } from '../../server/useServerStatus';
import { ServerStatusPill } from '../../ui/ServerStatusPill';
import { runCycle } from '../../sync/cycle';
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
    setMessage(
      r.ok
        ? `Conectado — versão ${r.version}, ${r.ms} ms`
        : 'Não foi possível conectar',
    );
    return r.ok;
  }

  function persist() {
    if (portNum === null) return;
    // server.id is kept on purpose: if the new address is another server,
    // the next health check reports mismatch and the banner lets the user choose.
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
            <View style={common.row}>
              <Button
                small
                label="Usar este servidor"
                onPress={() => {
                  acceptPendingServer(db);
                  void refreshServer();
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
        <Text style={common.muted}>Atualiza o catálogo, o progresso e a fila de downloads.</Text>
        <View style={common.row}>
          <Button
            variant="outline"
            icon="refresh-cw"
            label={syncing ? 'Sincronizando...' : 'Sincronizar agora'}
            disabled={syncing}
            testID="settings-sync"
            onPress={() => {
              setSyncing(true);
              void runCycle({ mode: 'foreground' }).finally(() => setSyncing(false));
            }}
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

const styles = StyleSheet.create({
  card: { padding: 16, gap: 14 },
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
