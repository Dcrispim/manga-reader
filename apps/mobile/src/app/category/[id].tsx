import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { useCategories } from "../../catalog/hooks";
import type { CatalogTitle } from "../../catalog/queries";
import { TitleGrid } from "../../ui/TitleGrid";

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
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: entry?.name ?? "Categoria" }} />
      {items.length === 0 ? (
        <Text style={{ padding: 24, textAlign: "center" }}>Nenhum título nesta categoria</Text>
      ) : (
        <TitleGrid items={items} />
      )}
    </View>
  );
}
