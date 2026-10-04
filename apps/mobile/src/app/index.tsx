import { CORE_VERSION } from "@manga/core";
import { StyleSheet, Text, View } from "react-native";

// Rendering CORE_VERSION proves Metro resolves the workspace package.
export default function Index() {
  return (
    <View style={styles.container}>
      <Text>Manga Reader</Text>
      <Text>{`CORE_VERSION: ${CORE_VERSION}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
