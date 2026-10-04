import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { db } from '../../db/client';
import { createClient } from '../../net/client';
import { formatRelative } from '../../settings/format';
import { getSetting } from '../../settings/repo';
import { connectBind, createBind, disconnectBind } from '../../sync/bind';
import { Button, Section, common } from '../../ui/SettingsBits';

export default function BindScreen() {
  const [code, setCode] = useState(getSetting(db, 'bind.code') || '');
  const [lastSync, setLastSync] = useState(Number(getSetting(db, 'bind.lastSync')) || 0);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    setCode(getSetting(db, 'bind.code') || '');
    setLastSync(Number(getSetting(db, 'bind.lastSync')) || 0);
  }

  async function onCreate() {
    setBusy(true);
    setMessage(null);
    const r = await createBind(db, createClient({ db }), Date.now());
    setBusy(false);
    if (!r.ok) setMessage('Não foi possível gerar o código agora.');
    refresh();
  }

  async function onConnect() {
    if (input.length !== 6) {
      setMessage('O código tem 6 caracteres.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const r = await connectBind(db, createClient({ db }), input);
    setBusy(false);
    if (!r.ok) {
      setMessage(r.reason === 'not_found' ? 'Código não encontrado' : 'Não foi possível conectar agora.');
    } else {
      setInput('');
    }
    refresh();
  }

  return (
    <ScrollView contentContainerStyle={common.container}>
      <Text style={common.title}>Sincronizar progresso</Text>
      {code ? (
        <Section title="Conectado">
          <Text style={styles.code} accessibilityLabel="Código de sincronização">
            {code}
          </Text>
          <Text>{`Última sincronização: ${formatRelative(lastSync, Date.now())}`}</Text>
          <Button
            label="Desconectar"
            danger
            onPress={() => {
              disconnectBind(db);
              refresh();
            }}
          />
        </Section>
      ) : (
        <>
          <Section title="Gerar código">
            <Text style={common.muted}>
              Cria um código com o seu histórico para usar em outro aparelho ou no web.
            </Text>
            <Button label="Gerar código" disabled={busy} onPress={() => void onCreate()} />
          </Section>
          <Section title="Conectar com código">
            <TextInput
              style={[common.input, styles.input]}
              value={input}
              onChangeText={(t) =>
                setInput(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))
              }
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              placeholder="ABC123"
              accessibilityLabel="Código"
            />
            <Button label="Conectar" disabled={busy} onPress={() => void onConnect()} />
          </Section>
        </>
      )}
      {message ? <Text>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 44, fontWeight: '700', letterSpacing: 6, textAlign: 'center' },
  input: { fontSize: 22, letterSpacing: 4 },
});
