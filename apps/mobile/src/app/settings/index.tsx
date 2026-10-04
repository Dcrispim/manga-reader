import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { db } from '../../db/client';
import { DEFAULTS, getSetting, setSetting } from '../../settings/repo';
import { acceptPendingServer, testAddress } from '../../server/status';
import { refreshServer, useServerStatus } from '../../server/useServerStatus';
import { ServerStatusPill } from '../../ui/ServerStatusPill';

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Configurações</Text>

      <View style={styles.row}>
        <Text>Servidor:</Text>
        <ServerStatusPill status={server.status} />
      </View>
      {savedId ? <Text>{`ID do servidor: ${savedId.slice(0, 8)}`}</Text> : null}

      {server.status === 'mismatch' && dismissedFor !== server.pendingServerId ? (
        <View style={styles.banner}>
          <Text>Este endereço aponta para outro servidor</Text>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                acceptPendingServer(db);
                void refreshServer();
              }}
            >
              <Text style={styles.link}>Usar este servidor</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDismissedFor(server.pendingServerId)}
            >
              <Text style={styles.link}>Manter</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Text>Host</Text>
      <TextInput
        style={styles.input}
        value={host}
        onChangeText={(t) => {
          setHost(t);
          setPassed(false);
        }}
        placeholder="192.168.0.10"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Host"
      />
      <Text>Porta</Text>
      <TextInput
        style={styles.input}
        value={port}
        onChangeText={(t) => {
          setPort(t);
          setPassed(false);
        }}
        keyboardType="numeric"
        accessibilityLabel="Porta"
      />

      <Pressable
        accessibilityRole="button"
        style={styles.button}
        disabled={busy}
        onPress={() => void onTest()}
      >
        <Text style={styles.buttonText}>Testar conexão</Text>
      </Pressable>
      {message ? <Text>{message}</Text> : null}
      <Pressable
        accessibilityRole="button"
        style={styles.button}
        disabled={busy}
        onPress={() => void onSave()}
      >
        <Text style={styles.buttonText}>Salvar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 10 },
  title: { fontSize: 22, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 6, padding: 8 },
  button: { backgroundColor: '#208AEF', padding: 12, borderRadius: 6, alignItems: 'center' },
  buttonText: { color: '#fff' },
  banner: { backgroundColor: '#fff3cd', padding: 10, borderRadius: 6, gap: 6 },
  link: { color: '#208AEF' },
});
