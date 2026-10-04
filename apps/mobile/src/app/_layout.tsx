import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { db, useMigrationsGate } from "../db/client";
import { getSetting } from "../settings/repo";
import { expoFileStore } from "../storage/files";
import { reconcile } from "../storage/downloads";

const centered = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
} as const;

// First run: no server address saved yet, so open Settings straight away.
function FirstRunRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!getSetting(db, "server.host")) router.replace("/settings");
  }, [router]);
  return null;
}

// Startup reconciliation of downloaded files vs. SQLite. Fire-and-forget so it
// never blocks the UI, and the catch keeps it from ever throwing.
function ReconcileOnStart() {
  useEffect(() => {
    reconcile(db, expoFileStore).catch(() => {});
  }, []);
  return null;
}

function MigrationGate({ onRestart }: { onRestart: () => void }) {
  const { success, error } = useMigrationsGate();

  if (error) {
    // Deliberately neutral: no stack trace for the user (it is in diag_log).
    return (
      <View style={centered}>
        <Text>Não foi possível abrir os dados do aplicativo.</Text>
        <Pressable accessibilityRole="button" onPress={onRestart}>
          <Text>Reiniciar</Text>
        </Pressable>
      </View>
    );
  }
  if (!success) {
    return (
      <View style={centered}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <ReconcileOnStart />
      <FirstRunRedirect />
    </>
  );
}

export default function RootLayout() {
  // Changing the key remounts the gate, which re-runs the migrations.
  const [attempt, setAttempt] = useState(0);
  return <MigrationGate key={attempt} onRestart={() => setAttempt((n) => n + 1)} />;
}
