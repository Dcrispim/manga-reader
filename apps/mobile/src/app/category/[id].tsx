import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useCategories } from "../../catalog/hooks";
import type { CatalogTitle } from "../../catalog/queries";
import { Text } from "../../ui/Text";
import { TitleGrid } from "../../ui/TitleGrid";
import { colors } from "../../ui/theme";

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { catalog, map } = useCategories();
  const entry = map[id];
  const items = useMemo(() => {
    const byName = new Map(catalog.map((t) => [t.name, t]));
    return (entry?.titles ?? [])
      .map((n) => byName.get(n))
      .filter((t): t is CatalogTitle => t !== undefined);
  }, [catalog, entry]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: entry ? `${entry.name} (${items.length})` : "Categoria" }} />
      {items.length === 0 ? (
        <Text style={styles.none}>Nenhum título nesta categoria</Text>
      ) : (
        <TitleGrid items={items} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  none: { padding: 24, textAlign: "center", color: colors.mutedForeground, fontStyle: "italic" },
});
