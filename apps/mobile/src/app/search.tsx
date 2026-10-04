import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { useCatalog } from "../catalog/hooks";
import { TitleGrid } from "../ui/TitleGrid";

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
    <View style={{ flex: 1 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Nome, autor ou categoria"
        autoFocus
        style={{ margin: 12, padding: 10, borderWidth: 1, borderColor: "#999", borderRadius: 8 }}
      />
      {query && results.length === 0 ? (
        <Text style={{ textAlign: "center", padding: 16 }}>Nada encontrado</Text>
      ) : (
        <TitleGrid items={results} />
      )}
    </View>
  );
}
