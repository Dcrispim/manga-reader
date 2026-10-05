import { Feather } from "@expo/vector-icons";
import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { useCatalog } from "../catalog/hooks";
import { Text } from "../ui/Text";
import { TitleGrid } from "../ui/TitleGrid";
import { colors, fonts, radius } from "../ui/theme";

const DEBOUNCE_MS = 150;

export default function SearchScreen() {
  const catalog = useCatalog();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  // In memory, built from the local titles: works offline.
  const fuse = useMemo(
    () =>
      new Fuse(
        catalog.map((t) => ({
          t,
          name: t.name,
          author: t.meta.author ?? t.meta.authors ?? "",
          categories: t.categories.join(" "),
        })),
        { keys: ["name", "author", "categories"], threshold: 0.35, ignoreLocation: true },
      ),
    [catalog],
  );
  const results = useMemo(
    () => (query ? fuse.search(query).map((r) => r.item.t) : []),
    [fuse, query],
  );

  return (
    <View style={styles.root}>
      <View style={styles.field}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Nome, autor ou categoria"
          placeholderTextColor={colors.mutedForeground}
          autoFocus
          style={styles.input}
        />
      </View>
      {query && results.length === 0 ? (
        <Text style={styles.none}>Nada encontrado</Text>
      ) : (
        <TitleGrid items={results} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    marginBottom: 0,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.card,
  },
  input: { flex: 1, paddingVertical: 12, color: colors.foreground, fontFamily: fonts.regular, fontSize: 15 },
  none: { textAlign: "center", padding: 24, color: colors.mutedForeground, fontStyle: "italic" },
});
