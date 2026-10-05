import { Link } from "expo-router";
import { memo, useMemo } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useHomeLists } from "../catalog/hooks";
import { categoriesOf, type CatalogTitle } from "../catalog/queries";
import { TitleCover } from "../ui/TitleCover";

// Memoized: the home re-renders on every history or download change, and only
// the carousels whose items actually changed should redo their covers.
const Carousel = memo(function Carousel({
  title,
  items,
  caption,
  seeAll,
}: {
  title: string;
  items: CatalogTitle[];
  caption?: (t: CatalogTitle) => string | null;
  seeAll?: string;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {seeAll ? (
          <Link href={{ pathname: "/category/[id]", params: { id: seeAll } }}>Ver tudo</Link>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={items.slice(0, 20)}
        keyExtractor={(t) => t.name}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, gap: 8 }}
        renderItem={({ item, index }) => (
          <Link href={{ pathname: "/title/[name]", params: { name: item.name } }}>
            <View style={styles.card} testID={`title-card-${index}`}>
              <TitleCover name={item.name} thumbPath={item.thumbPath} />
              <Text numberOfLines={2} style={styles.cardName}>
                {item.name}
              </Text>
              {caption?.(item) ? <Text style={styles.cardCaption}>{caption(item)}</Text> : null}
            </View>
          </Link>
        )}
      />
    </View>
  );
});

export default function Home() {
  const { catalog, continueItems, downloaded } = useHomeLists();
  const byName = useMemo(() => new Map(catalog.map((t) => [t.name, t])), [catalog]);
  const categories = useMemo(() => Object.entries(categoriesOf(catalog)), [catalog]);

  const pick = useMemo(
    () => (names: string[]) =>
      names.map((n) => byName.get(n)).filter((t): t is CatalogTitle => t !== undefined),
    [byName],
  );
  const continueList = useMemo(() => pick(continueItems.map((c) => c.title)), [pick, continueItems]);
  const continueCaption = useMemo(() => {
    const lastChapter = new Map(continueItems.map((c) => [c.title, c.chapter]));
    return (t: CatalogTitle) => `Cap. ${lastChapter.get(t.name)}`;
  }, [continueItems]);
  const downloadedList = useMemo(() => pick(downloaded), [pick, downloaded]);
  const categoryLists = useMemo(
    () => categories.map(([id, c]) => ({ id, name: c.name, items: pick(c.titles) })),
    [pick, categories],
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Link href="/search">Buscar</Link>
        <Link href="/settings">Configurações</Link>
      </View>
      {catalog.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Nenhum título ainda. Configure o servidor ou adicione uma pasta local
          </Text>
          <Pressable accessibilityRole="button">
            <Link href="/settings">Abrir configurações</Link>
          </Pressable>
        </View>
      ) : (
        <>
          <Carousel title="Continuar lendo" items={continueList} caption={continueCaption} />
          <Carousel title="Baixados" items={downloadedList} />
          {categoryLists.map((c) => (
            <Carousel key={c.id} title={c.name} items={c.items} seeAll={c.id} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 8, flexGrow: 1 },
  toolbar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  section: { marginBottom: 16 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  card: { width: 110 },
  cardName: { fontSize: 12, marginTop: 4 },
  cardCaption: { fontSize: 11, color: "#777" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyText: { textAlign: "center", fontSize: 15 },
});
