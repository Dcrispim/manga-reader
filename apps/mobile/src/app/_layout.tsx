import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useMigrationsGate } from "../db/client";

const centered = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
} as const;

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
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  // Changing the key remounts the gate, which re-runs the migrations.
  const [attempt, setAttempt] = useState(0);
  return <MigrationGate key={attempt} onRestart={() => setAttempt((n) => n + 1)} />;
}
