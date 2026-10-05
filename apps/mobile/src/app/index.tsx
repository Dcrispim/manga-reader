import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { memo, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHomeLists } from "../catalog/hooks";
import { categoriesOf, type CatalogTitle } from "../catalog/queries";
import { db } from "../db/client";
import { createClient } from "../net/client";
import { useServerStatus } from "../server/useServerStatus";
import { usePullRefresh } from "../sync/usePullRefresh";
import { Button } from "../ui/Button";
import { displayName } from "../ui/displayName";
import { Logo } from "../ui/Logo";
import { PosterCard } from "../ui/PosterCard";
import { ServerStatusPill } from "../ui/ServerStatusPill";
import { Text } from "../ui/Text";
import { colors, radius } from "../ui/theme";

const client = createClient({ db });

// Chapter-01 page used as the hero backdrop, as on the web (page 0 is often a
// credits splash). Falls back to the cover when offline or on error.
const HERO_PAGE_OFFSET = 2;
const HERO_ROTATE_MS = 20_000;

// Memoized: the home re-renders on every history or download change, and only
// the carousels whose items actually changed should redo their covers.
const Carousel = memo(function Carousel({
  title,
  icon,
  items,
  badge,
  cardWidth,
  pad,
  testPrefix = "title-card",
  seeAll,
}: {
  /** Category id: shows "Ver tudo", which opens the full grid. */
  seeAll?: string;
  title: string;
  icon?: "clock";
  /** E2E ids: category cards keep "title-card-N", which always open the title. */
  testPrefix?: string;
  items: CatalogTitle[];
  badge?: (t: CatalogTitle) => { label: string; chapter: string } | null;
  cardWidth: number;
  pad: number;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHead, { paddingHorizontal: pad }]}>
        {icon ? <Feather name={icon} size={20} color="#fff" /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {seeAll ? (
          <Link href={{ pathname: "/category/[id]", params: { id: seeAll } }} asChild>
            <Pressable accessibilityRole="link" style={styles.seeAll} hitSlop={8}>
              <Text style={styles.seeAllText}>Ver tudo</Text>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            </Pressable>
          </Link>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(t) => t.name}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: pad, gap: 12 }}
        renderItem={({ item, index }) => {
          const b = badge?.(item) ?? null;
          return (
            <PosterCard
              name={item.name}
              thumbPath={item.thumbPath}
              caps={item.caps}
              width={cardWidth}
              badge={b?.label}
              href={
                b
                  ? { pathname: "/read/[title]/[chapter]", params: { title: item.name, chapter: b.chapter } }
                  : undefined
              }
              testID={`${testPrefix}-${index}`}
            />
          );
        }}
      />
    </View>
  );
});

function Hero({
  pool,
  continueOf,
  height,
  pad,
}: {
  pool: CatalogTitle[];
  continueOf: Map<string, string>;
  height: number;
  pad: number;
}) {
  const router = useRouter();
  const { status } = useServerStatus();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * Math.min(pool.length, 10)));
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (pool.length < 2) return;
    const t = setInterval(() => setIndex(Math.floor(Math.random() * pool.length)), HERO_ROTATE_MS);
    return () => clearInterval(t);
  }, [pool.length]);

  const title = pool[index % pool.length];
  if (!title) return null;
  const page = client.url(`/api/read/${encodeURIComponent(title.name)}/01/${HERO_PAGE_OFFSET}`);
  const useRemote = status === "online" && page !== null && failed !== title.name;
  const source = useRemote ? page : title.thumbPath;
  const chapter = continueOf.get(title.name);
  const author = title.meta.author || title.meta.authors;
  const openTitle = () => router.push({ pathname: "/title/[name]", params: { name: title.name } });

  return (
    <View style={{ height }}>
      {source ? (
        <Image
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
          onError={() => setFailed(title.name)}
        />
      ) : null}
      <LinearGradient
        colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.5)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={["transparent", "transparent", "#000"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.heroBody, { padding: pad + 16 }]}>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {displayName(title.name)}
        </Text>
        <Text style={styles.heroCaps}>{`${title.caps} capítulos`}</Text>
        {author ? (
          <Text style={styles.heroDesc} numberOfLines={3}>
            {`Por ${author}`}
          </Text>
        ) : null}
        <View style={styles.heroActions}>
          <Button
            variant="white"
            icon="play"
            label={chapter ? `Continuar Cap. ${chapter}` : "Ler agora"}
            onPress={() =>
              chapter
                ? router.push({ pathname: "/read/[title]/[chapter]", params: { title: title.name, chapter } })
                : openTitle()
            }
          />
          <Button variant="outline" icon="info" label="Mais info" style={styles.heroOutline} onPress={openTitle} />
        </View>
      </View>
    </View>
  );
}

function TopBar({ top, pad }: { top: number; pad: number }) {
  const { status } = useServerStatus();
  return (
    <View style={[styles.topBar, { top: top + 8, right: pad }]}>
      <ServerStatusPill status={status} />
      <Link href="/search" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Pesquisar" style={styles.searchPill}>
          <Feather name="search" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.searchText}>Pesquisar</Text>
        </Pressable>
      </Link>
      <Link href="/settings" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Configurações" style={styles.roundBtn}>
          <Feather name="settings" size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </Link>
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 768;
  const pad = wide ? 32 : 16;
  const cardWidth = wide ? 176 : 144;
  const heroHeight = Math.max(360, Math.min(height * 0.6, width * 0.95));

  const { catalog, continueItems, downloaded } = useHomeLists();
  const { refreshing, onRefresh } = usePullRefresh();
  const { status } = useServerStatus();
  const [onlyOffline, setOnlyOffline] = useState(false);
  const byName = useMemo(() => new Map(catalog.map((t) => [t.name, t])), [catalog]);
  const categories = useMemo(() => Object.entries(categoriesOf(catalog)), [catalog]);

  const pick = useMemo(
    () => (names: string[]) =>
      names.map((n) => byName.get(n)).filter((t): t is CatalogTitle => t !== undefined),
    [byName],
  );
  const continueList = useMemo(() => pick(continueItems.map((c) => c.title)), [pick, continueItems]);
  const continueOf = useMemo(
    () => new Map(continueItems.map((c) => [c.title, c.chapter])),
    [continueItems],
  );
  const continueBadge = useMemo(
    () => (t: CatalogTitle) => {
      const chapter = continueOf.get(t.name);
      return chapter ? { label: `Cap. ${chapter}`, chapter } : null;
    },
    [continueOf],
  );
  const offlineSet = useMemo(() => new Set(downloaded), [downloaded]);
  // Same rule as the web: categories with more than two titles; in offline
  // mode, any category that still has a saved title.
  const categoryLists = useMemo(
    () =>
      categories
        .map(([id, c]) => {
          const items = pick(c.titles).filter((t) => !onlyOffline || offlineSet.has(t.name));
          return { id, title: onlyOffline ? c.name : `${c.name} (${c.titles.length})`, items };
        })
        .filter((c) => (onlyOffline ? c.items.length > 0 : c.items.length > 2)),
    [pick, categories, onlyOffline, offlineSet],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={insets.top + 48}
            tintColor={colors.foreground}
            colors={[colors.primaryForeground]}
            progressBackgroundColor={colors.primary}
          />
        }
      >
        {catalog.length === 0 ? (
          <View style={[styles.empty, { paddingTop: insets.top + 96 }]}>
            <Logo size={64} opacity={0.8} />
            <Text style={styles.emptyText}>
              Nenhum título ainda. Configure o servidor ou adicione uma pasta local
            </Text>
            <Button label="Abrir configurações" onPress={() => router.push("/settings")} />
          </View>
        ) : (
          <>
            <Hero pool={catalog} continueOf={continueOf} height={heroHeight} pad={pad} />
            <Carousel
              title="Continuar Lendo"
              icon="clock"
              items={continueList}
              badge={continueBadge}
              testPrefix="continue-card"
              cardWidth={cardWidth}
              pad={pad}
            />
            <View style={[styles.filterRow, { paddingHorizontal: pad }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOnlyOffline((v) => !v)}
                style={[styles.filter, onlyOffline && styles.filterOn]}
              >
                <Feather
                  name="hard-drive"
                  size={14}
                  color={onlyOffline ? colors.primary : "rgba(255,255,255,0.7)"}
                />
                <Text style={[styles.filterText, onlyOffline && { color: colors.primary }]}>
                  {onlyOffline ? `Salvos offline (${offlineSet.size})` : "Mostrar apenas salvos offline"}
                </Text>
              </Pressable>
            </View>
            {categoryLists.map((c) => (
              <Carousel
                key={c.id}
                title={c.title}
                items={c.items}
                seeAll={c.id}
                cardWidth={cardWidth}
                pad={pad}
              />
            ))}
            {onlyOffline && offlineSet.size === 0 ? (
              <Text style={[styles.noneOffline, { paddingHorizontal: pad }]}>
                Nenhum título salvo offline ainda.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={[styles.brand, { top: insets.top + 8, left: pad }]} pointerEvents="none">
        <Logo size={30} />
      </View>
      <TopBar top={insets.top} pad={pad} />
      {status === "mismatch" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/settings")}
          style={[styles.mismatch, { top: insets.top + 52, left: pad, right: pad }]}
        >
          <Feather name="alert-triangle" size={16} color={colors.warning} />
          <Text style={styles.mismatchText}>
            Este endereço é de outro servidor e nada está sincronizando. Toque para escolher.
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { paddingBottom: 48, gap: 32, flexGrow: 1 },
  section: { gap: 16 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#fff", flex: 1 },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontSize: 13, color: colors.mutedForeground },
  heroBody: { flex: 1, justifyContent: "flex-end", maxWidth: 672 },
  heroTitle: { fontSize: 32, fontWeight: "700", color: "#fff", marginBottom: 16 },
  heroCaps: { color: colors.gray300, fontSize: 14, marginBottom: 8 },
  heroDesc: { color: colors.gray400, fontSize: 14, marginBottom: 24 },
  heroActions: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  heroOutline: { borderColor: colors.gray500, borderRadius: radius.md },
  topBar: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 8 },
  mismatch: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(240,177,0,0.4)",
    backgroundColor: "rgba(20,16,0,0.92)",
  },
  mismatchText: { flex: 1, fontSize: 13, color: colors.foreground },
  brand: { position: "absolute", height: 32, justifyContent: "center" },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  searchText: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  roundBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: { flexDirection: "row", justifyContent: "flex-end" },
  filter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  filterOn: { borderColor: colors.primary, backgroundColor: "rgba(229,229,229,0.1)" },
  filterText: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  noneOffline: { fontSize: 14, color: "rgba(255,255,255,0.5)", fontStyle: "italic" },
  empty: { flex: 1, alignItems: "center", gap: 16, padding: 24 },
  emptyText: { textAlign: "center", fontSize: 15, color: colors.mutedForeground, maxWidth: 360 },
});
