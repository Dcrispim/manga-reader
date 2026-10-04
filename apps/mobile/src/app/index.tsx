import { CORE_VERSION } from "@manga/core";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useServerStatus } from "../server/useServerStatus";
import { ServerStatusPill } from "../ui/ServerStatusPill";

// Rendering CORE_VERSION proves Metro resolves the workspace package.
export default function Index() {
  const { status } = useServerStatus();
  return (
    <View style={styles.container}>
      <Text>Manga Reader</Text>
      <Text>{`CORE_VERSION: ${CORE_VERSION}`}</Text>
      <ServerStatusPill status={status} />
      <Link href="/settings">Configurações</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
