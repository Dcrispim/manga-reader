import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { db, useMigrationsGate } from "../db/client";
import { getSetting } from "../settings/repo";
import { expoFileStore } from "../storage/files";
import { reconcile } from "../storage/downloads";
import { reconcileTransient } from "../storage/transient";
import "../sync/backgroundTask";
import { useServerStatus } from "../server/useServerStatus";
import { ScreenBoundary } from "../ui/ScreenBoundary";
import { ServerStatusPill } from "../ui/ServerStatusPill";
import { useForegroundSync } from "../sync/useForegroundSync";

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
    reconcileTransient(db, expoFileStore).catch(() => {});
  }, []);
  return null;
}

// Mounted only after the migrations gate, so every cycle sees a ready schema.
function ForegroundSync() {
  useForegroundSync();
  return null;
}

// Single mount point of useServerStatus, so there is one revalidation timer.
function HeaderPill() {
  const { status } = useServerStatus();
  return <ServerStatusPill status={status} />;
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScreenBoundary>
        <Stack screenOptions={{ headerRight: () => <HeaderPill /> }}>
          <Stack.Screen name="index" options={{ title: "Manga Reader" }} />
          <Stack.Screen name="search" options={{ title: "Buscar" }} />
          <Stack.Screen name="category/[id]" options={{ title: "Categoria" }} />
          <Stack.Screen name="title/[name]" options={{ title: "" }} />
          <Stack.Screen name="read/[title]/[chapter]" options={{ title: "" }} />
          <Stack.Screen name="settings/index" options={{ title: "Configurações" }} />
          <Stack.Screen name="settings/storage" options={{ title: "Armazenamento" }} />
          <Stack.Screen name="settings/queue" options={{ title: "Fila de downloads" }} />
          <Stack.Screen name="settings/bind" options={{ title: "Sincronizar progresso" }} />
          <Stack.Screen name="settings/diagnostics" options={{ title: "Diagnóstico" }} />
        </Stack>
      </ScreenBoundary>
      <ReconcileOnStart />
      <ForegroundSync />
      <FirstRunRedirect />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  // Changing the key remounts the gate, which re-runs the migrations.
  const [attempt, setAttempt] = useState(0);
  return <MigrationGate key={attempt} onRestart={() => setAttempt((n) => n + 1)} />;
}
