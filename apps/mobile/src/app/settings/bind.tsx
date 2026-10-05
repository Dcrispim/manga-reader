import { sql } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { db } from '../../db/client';
import { useLiveQuery } from '../../db/liveQuery';
import { history, settings } from '../../db/schema';
import { createClient } from '../../net/client';
import { formatRelative } from '../../settings/format';
import { getSetting } from '../../settings/repo';
import { getServerState } from '../../server/status';
import { connectBind, createBind, disconnectBind, syncBind } from '../../sync/bind';
import { describeBind, recordOutcome } from '../../sync/syncStatus';
import { Button, Section, common } from '../../ui/SettingsBits';
import { Text } from '../../ui/Text';
import { colors } from '../../ui/theme';

const clean = (t: string) => t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);

export default function BindScreen() {
  // Re-render on any settings change (code, last sync) and on history writes.
  useLiveQuery(db.select().from(settings));
  const { data: counts } = useLiveQuery(
    db
      .select({ total: sql<number>`count(*)`, pending: sql<number>`coalesce(sum(${history.pending}), 0)` })
      .from(history),
  );
  const total = Number(counts?.[0]?.total ?? 0);
  const pending = Number(counts?.[0]?.pending ?? 0);
  const code = getSetting(db, 'bind.code') || '';
  const lastSync = Number(getSetting(db, 'bind.lastSync')) || 0;
  const [input, setInput] = useState('');
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function run(task: () => Promise<{ ok: boolean; text: string }>) {
    setBusy(true);
    setMessage(null);
    const r = await task();
    setBusy(false);
    setMessage(r);
    setNow(Date.now());
  }

  const syncNow = async () => {
    const s = await syncBind({ db, client: createClient({ db }), now: Date.now(), status: getServerState().status });
    recordOutcome(db, 'bind', s);
    return describeBind(s);
  };

  const onCreate = () =>
    run(async () => {
      const r = await createBind(db, createClient({ db }), Date.now());
      return r.ok ? { ok: true, text: `Código ${r.code} criado.` } : { ok: false, text: 'Não foi possível gerar o código agora.' };
    });

  const onConnect = () =>
    run(async () => {
      if (input.length !== 6) return { ok: false, text: 'O código tem 6 caracteres.' };
      const r = await connectBind(db, createClient({ db }), input);
      if (!r.ok) {
        return {
          ok: false,
          text: r.reason === 'not_found' ? 'Código não encontrado neste servidor.' : 'Não foi possível conectar agora.',
        };
      }
      setInput('');
      setSwitching(false);
      // Push this device's history right away, so the result is visible.
      const d = await syncNow();
      return { ok: d.ok, text: `Conectado a ${r.code}. Sincronização: ${d.text}.` };
    });

  const onSyncNow = () =>
    run(async () => {
      const d = await syncNow();
      return { ok: d.ok, text: `Sincronização: ${d.text}.` };
    });

  function confirmClearHistory() {
    Alert.alert(
      'Apagar o histórico deste aparelho?',
      code
        ? 'Remove os capítulos lidos registrados neste aparelho. Com o bind conectado, o histórico do bind volta na próxima sincronização; para descartar só o que é local, desconecte antes.'
        : 'Remove os capítulos lidos registrados neste aparelho (Continuar lendo, Lido). Nada é apagado no servidor.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => {
            db.delete(history).run();
            setMessage({ ok: true, text: 'Histórico deste aparelho apagado.' });
          },
        },
      ],
    );
  }

  const codeInput = (
    <View style={styles.connectRow}>
      <TextInput
        style={[common.input, styles.input]}
        value={input}
        onChangeText={(t) => setInput(clean(t))}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        placeholder="ABC123"
        placeholderTextColor={colors.mutedForeground}
        accessibilityLabel="Código"
      />
      <Button label="Conectar" disabled={busy} onPress={() => void onConnect()} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={common.container}>
      {code ? (
        <Section title="Conectado">
          <Text style={styles.code} accessibilityLabel="Código de sincronização">
            {code}
          </Text>
          <Text style={common.muted}>
            {`Última sincronização: ${lastSync ? formatRelative(lastSync, now) : 'nunca'}`}
          </Text>
          <View style={common.row}>
            <Button label={busy ? 'Sincronizando...' : 'Sincronizar agora'} disabled={busy} onPress={() => void onSyncNow()} />
            <Button label="Trocar código" disabled={busy} onPress={() => setSwitching((v) => !v)} />
            <Button
              label="Desconectar"
              danger
              disabled={busy}
              onPress={() => {
                disconnectBind(db);
                setSwitching(false);
                setMessage({ ok: true, text: 'Bind desconectado. O histórico deste aparelho continua aqui.' });
              }}
            />
          </View>
          {switching ? (
            <>
              <Text style={common.muted}>
                Conecte outro código deste servidor. O histórico deste aparelho também é enviado para ele.
              </Text>
              {codeInput}
            </>
          ) : null}
        </Section>
      ) : (
        <>
          <Section title="Conectar com código">
            <Text style={common.muted}>Use o código gerado no web ou em outro aparelho, neste mesmo servidor.</Text>
            {codeInput}
          </Section>
          <Section title="Gerar código">
            <Text style={common.muted}>Cria um código com o seu histórico para usar em outro aparelho ou no web.</Text>
            <View style={common.row}>
              <Button label="Gerar código" disabled={busy} onPress={() => void onCreate()} />
            </View>
          </Section>
        </>
      )}

      <Section title="Histórico deste aparelho">
        <Text style={common.muted}>
          {total
            ? `${total} capítulo(s) registrados${pending ? `, ${pending} ainda não enviados ao bind` : ''}.`
            : 'Nenhum capítulo registrado.'}
        </Text>
        <View style={common.row}>
          <Button label="Apagar histórico deste aparelho" danger disabled={busy || total === 0} onPress={confirmClearHistory} />
        </View>
      </Section>

      {message ? <Text style={message.ok ? styles.ok : styles.error}>{message.text}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 44, fontWeight: '700', letterSpacing: 6, textAlign: 'center', paddingVertical: 8 },
  connectRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontSize: 22, letterSpacing: 4 },
  ok: { fontSize: 13, color: colors.online },
  error: { fontSize: 13, color: colors.destructive },
});
