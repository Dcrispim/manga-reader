import { Feather } from "@expo/vector-icons";
import { normalizeCategory } from "@manga/core";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";

import {
  badgeLabel,
  buildCatalog,
  chapterRows,
  continueReading,
  q,
  type ChapterRow,
} from "../../catalog/queries";
import { computeVolumes, volumeNote, volumeRange } from "../../catalog/volumes";
import { db } from "../../db/client";
import { useLiveQuery } from "../../db/liveQuery";
import { enqueueAndDrain } from "../../jobs/drain";
import { createClient } from "../../net/client";
import { hasFeature } from "../../server/status";
import { useServerStatus } from "../../server/useServerStatus";
import { deleteChapter } from "../../storage/downloads";
import { expoFileStore } from "../../storage/files";
import { syncTitleOnDemand } from "../../sync/catalog";
import { usePullRefresh } from "../../sync/usePullRefresh";
import { Button, IconButton } from "../../ui/Button";
import { Card, Chip, Label } from "../../ui/Card";
import { displayName } from "../../ui/displayName";
import { Text } from "../../ui/Text";
import { TitleCover } from "../../ui/TitleCover";
import { colors, radius } from "../../ui/theme";

// Same facts, same order and labels as the web's "Ficha técnica".
const FACTS: [string, string][] = [
  ["type", "Tipo"],
  ["status", "Status"],
  ["demographic", "Demografia"],
  ["published", "Publicação"],
];

// The web marks the three most recently modified chapters as "Novo".
const NEW_COUNT = 3;

type Status = "read" | "new" | "unread";
const STATUS_LABEL: Record<Status, string> = { read: "Lido", new: "Novo", unread: "Não lido" };

function formatDate(ms: number): string {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

function Dot({ status }: { status: Status }) {
  return <View style={[styles.dot, DOT[status]]} />;
}

const DOT = {
  read: { backgroundColor: "rgba(161,161,161,0.6)" },
  unread: { borderWidth: 1, borderColor: "rgba(161,161,161,0.6)" },
  new: { backgroundColor: colors.newChapter },
};

export default function TitleScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { status } = useServerStatus();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const [ascending, setAscending] = useState(false);
  const [activeVolume, setActiveVolume] = useState<number | null>(null);
  const listRef = useRef<FlatList<ChapterRow>>(null);
  const { refreshing, onRefresh } = usePullRefresh();
  const chaptersY = useRef(0);
  const tabsRef = useRef<ScrollView>(null);
  const tabX = useRef<number[]>([]);

  const { data: titleRows } = useLiveQuery(q.titleTitles(db, name), [name]);
  const { data: counts } = useLiveQuery(q.chapterCounts(db));
  const { data: sources } = useLiveQuery(q.sources(db, name), [name]);
  const { data: dls } = useLiveQuery(q.titleDownloads(db, name), [name]);
  const { data: transient } = useLiveQuery(q.titleTransient(db, name), [name]);
  const { data: jobRows } = useLiveQuery(q.titleJobs(db, name), [name]);
  const { data: hist } = useLiveQuery(q.titleHistory(db, name), [name]);

  // Degraded mode (server without the catalog feature): refresh this title in
  // the background; the live queries above pick the result up on their own.
  useEffect(() => {
    if (status !== "online" || hasFeature("catalog")) return;
    void syncTitleOnDemand({ db, client: createClient({ db }) }, name);
  }, [status, name]);

  const title = useMemo(() => buildCatalog(titleRows ?? [], counts ?? [])[0], [titleRows, counts]);
  const allRows = useMemo(
    () =>
      chapterRows({
        sources: sources ?? [],
        downloads: dls ?? [],
        transient: transient ?? [],
        jobs: jobRows ?? [],
        history: hist ?? [],
      }),
    [sources, dls, transient, jobRows, hist],
  );
  const continueChapter = useMemo(
    () => continueReading(hist ?? [], new Set([name]))[0]?.chapter ?? null,
    [hist, name],
  );
  const recent = useMemo(
    () => new Set([...allRows].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, NEW_COUNT).map((r) => r.chapter)),
    [allRows],
  );
  const volumesField = String(title?.meta.volumes ?? "");
  const volumes = useMemo(
    () => computeVolumes([...allRows].sort((a, b) => a.number - b.number).map((r) => r.chapter), volumesField),
    [allRows, volumesField],
  );
  // Default tab: the one holding the chapter to continue, else the last one.
  const defaultVolume = useMemo(() => {
    const i = continueChapter ? volumes.findIndex((v) => v.chapters.includes(continueChapter)) : -1;
    return i >= 0 ? i : Math.max(0, volumes.length - 1);
  }, [volumes, continueChapter]);
  const volumeIndex = activeVolume !== null && activeVolume < volumes.length ? activeVolume : defaultVolume;
  // Bring the default tab into view (it is often the last one, off screen).
  const scrollTabs = () =>
    tabsRef.current?.scrollTo({ x: Math.max(0, (tabX.current[volumeIndex] ?? 0) - 40), animated: false });
  const rows = useMemo(() => {
    const inVolume = new Set(volumes[volumeIndex]?.chapters ?? []);
    const list = volumes.length ? allRows.filter((r) => inVolume.has(r.chapter)) : allRows;
    return ascending ? [...list].reverse() : list;
  }, [allRows, volumes, volumeIndex, ascending]);

  const online = status === "online";
  const meta = (title?.meta ?? {}) as Record<string, string | undefined>;
  const author = meta.author || meta.authors;
  const readCount = new Set((hist ?? []).map((h) => h.chapter)).size;
  const total = allRows.length;
  const progressPct = total ? Math.round((readCount / total) * 100) : 0;
  const firstChapter = allRows.length ? allRows[allRows.length - 1].chapter : null;
  const primaryTarget =
    continueChapter && allRows.some((r) => r.chapter === continueChapter) ? continueChapter : firstChapter;
  const genres = (title?.categories ?? []).map(normalizeCategory);
  const statusOf = (r: ChapterRow): Status => (r.read ? "read" : recent.has(r.chapter) ? "new" : "unread");
  const openChapter = (chapter: string) =>
    router.push({ pathname: "/read/[title]/[chapter]", params: { title: name, chapter } });

  const hero = (
    <Card style={[styles.hero, wide && styles.heroWide]}>
      <View style={wide ? styles.coverWide : styles.coverNarrow}>
        <TitleCover name={name} thumbPath={title?.thumbPath ?? null} style={styles.cover} />
      </View>
      <View style={styles.heroInfo}>
        <Text style={styles.title}>{displayName(name)}</Text>
        <Text style={[styles.author, !author && styles.italic]}>{author || "Autor não informado"}</Text>
        <Text style={[styles.desc, !meta.description && styles.descEmpty]}>
          {meta.description || "Sinopse não cadastrada para este título."}
        </Text>
        <View style={styles.actions}>
          {primaryTarget ? (
            <Button
              label={continueChapter ? `Continuar no cap. ${continueChapter}` : "Começar a ler"}
              onPress={() => openChapter(primaryTarget)}
            />
          ) : (
            <Text style={styles.italicMuted}>Nenhum capítulo encontrado</Text>
          )}
          <Button
            variant="outline"
            label="Ver capítulos"
            onPress={() => listRef.current?.scrollToOffset({ offset: chaptersY.current, animated: true })}
          />
          {readCount > 0 ? <Text style={styles.small}>{`${readCount} de ${total} capítulos lidos`}</Text> : null}
        </View>
      </View>
    </Card>
  );

  const facts = (
    <Card style={[styles.factsCard, wide && styles.factsWide]}>
      <View style={wide ? styles.factsCol : undefined}>
        <Label style={styles.labelGap}>Ficha técnica</Label>
        {FACTS.filter(([k]) => meta[k]).map(([k, label]) => (
          <View key={k} style={styles.fact}>
            <Label>{label}</Label>
            <Text style={styles.factValue}>{meta[k]}</Text>
          </View>
        ))}
        <View style={[styles.fact, styles.factLast]}>
          <Label>Capítulos</Label>
          <Text style={styles.factValue}>{String(total)}</Text>
        </View>
      </View>
      <View style={wide ? styles.factsCol : styles.genres}>
        <Label style={styles.labelGap}>Gêneros</Label>
        <View style={styles.chips}>
          {genres.length ? (
            genres.map((g) => <Chip key={g}>{g}</Chip>)
          ) : (
            <Chip tone="dashed">Sem categorias cadastradas</Chip>
          )}
        </View>
      </View>
    </Card>
  );

  const chaptersHead = (
    <View
      style={styles.chaptersHead}
      onLayout={(e) => {
        chaptersY.current = e.nativeEvent.layout.y;
      }}
    >
      <View style={styles.chaptersTitleRow}>
        <View style={styles.chaptersTitleLine}>
          <Text style={styles.chaptersTitle}>Capítulos</Text>
          <Button
            small
            variant="outline"
            icon={ascending ? "arrow-up" : "arrow-down"}
            label={ascending ? "Mais antigos primeiro" : "Mais recentes primeiro"}
            accessibilityLabel="Inverter a ordem dos capítulos"
            onPress={() => setAscending((a) => !a)}
          />
        </View>
        <Text style={styles.note}>{volumeNote(volumesField)}</Text>
      </View>
      <View style={styles.progressBlock}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progressPct}%` }]} />
        </View>
        <View style={styles.progressText}>
          <Text style={styles.small}>
            {readCount > 0 ? `${readCount} de ${total} capítulos lidos` : "Nenhum capítulo lido ainda"}
          </Text>
          <Text style={styles.small}>{`${progressPct}%`}</Text>
        </View>
      </View>
      {volumes.length > 1 ? (
        <ScrollView
          ref={tabsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={styles.tabsContent}
        >
          {volumes.map((v, i) => (
            <Pressable
              key={v.label}
              onLayout={(e) => {
                tabX.current[i] = e.nativeEvent.layout.x;
                if (i === volumeIndex && activeVolume === null) scrollTabs();
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === volumeIndex }}
              onPress={() => setActiveVolume(i)}
              style={[styles.tab, i === volumeIndex && styles.tabOn]}
            >
              <Text style={[styles.tabText, i === volumeIndex && styles.tabTextOn]}>{v.label}</Text>
              <Text style={styles.tabRange}>{volumeRange(v)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.legend}>
        {(["read", "unread", "new"] as Status[]).map((s) => (
          <View key={s} style={styles.legendItem}>
            <Dot status={s} />
            <Text style={styles.small}>{STATUS_LABEL[s]}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "" }} />
      <FlatList
        ref={listRef}
        data={rows}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primaryForeground]}
            progressBackgroundColor={colors.primary}
          />
        }
        keyExtractor={(r) => r.chapter}
        contentContainerStyle={[styles.content, wide && styles.contentWide]}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            {hero}
            {facts}
            {chaptersHead}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyRow}>
            <Text style={styles.italicMuted}>Nenhum capítulo encontrado.</Text>
          </View>
        }
        ListFooterComponent={<View style={styles.chaptersFoot} />}
        renderItem={({ item, index }) => (
          <ChapterItem
            title={name}
            row={item}
            status={statusOf(item)}
            online={online}
            index={index}
            onOpen={openChapter}
          />
        )}
      />
    </View>
  );
}

const ChapterItem = memo(function ChapterItem({
  title,
  row,
  status,
  online,
  index,
  onOpen,
}: {
  title: string;
  row: ChapterRow;
  status: Status;
  online: boolean;
  index: number;
  onOpen: (chapter: string) => void;
}) {
  const label = badgeLabel(row.badge);
  const canDownload = row.onServer && (row.badge.kind === "none" || row.badge.kind === "cached");
  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}
        accessibilityRole="button"
        testID={`chapter-row-${index}`}
        onPress={() => onOpen(row.chapter)}
      >
        <Text style={styles.num}>{row.chapter}</Text>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{`Capítulo ${row.chapter}`}</Text>
          <View style={styles.rowMeta}>
            <Dot status={status} />
            <Text style={[styles.small, status === "new" && { color: colors.newChapter }]}>
              {STATUS_LABEL[status]}
            </Text>
            {row.pages ? <Text style={styles.small}>{`· ${row.pages} págs.`}</Text> : null}
            <Text style={styles.small}>{`· ${formatDate(row.mtimeMs)}`}</Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.rowActions}>
        {label ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} testID={`chapter-badge-${index}`}>
              {label}
            </Text>
          </View>
        ) : null}
        {canDownload ? (
          <IconButton
            icon="download"
            label={online ? "Baixar" : "Baixar quando disponível"}
            testID={`download-button-${index}`}
            onPress={() => enqueueAndDrain(db, "download", title, row.chapter)}
          />
        ) : null}
        {row.badge.kind === "downloaded" ? (
          <IconButton
            icon="trash-2"
            label="Remover download"
            onPress={() => void deleteChapter(db, expoFileStore, title, row.chapter)}
          />
        ) : null}
        <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  contentWide: { paddingHorizontal: 32, maxWidth: 1080, width: "100%", alignSelf: "center" },
  headerStack: { gap: 16 },
  hero: { padding: 20, gap: 20 },
  heroWide: { flexDirection: "row", padding: 28, gap: 28 },
  coverWide: { width: 200 },
  coverNarrow: { width: 160, alignSelf: "center" },
  cover: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  heroInfo: { flex: 1, gap: 12 },
  title: { fontSize: 30, fontWeight: "700" },
  author: { fontSize: 14, color: colors.mutedForeground, marginTop: -4 },
  italic: { fontStyle: "italic" },
  desc: { fontSize: 14, lineHeight: 22, color: "rgba(250,250,250,0.8)" },
  descEmpty: { fontStyle: "italic", color: colors.mutedForeground },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 4 },
  small: { fontSize: 12, color: colors.mutedForeground },
  italicMuted: { fontSize: 14, fontStyle: "italic", color: colors.mutedForeground },
  factsCard: { padding: 20, gap: 20 },
  factsWide: { flexDirection: "row", gap: 32 },
  factsCol: { flex: 1 },
  labelGap: { marginBottom: 8 },
  fact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: colors.borderSoft,
  },
  factLast: { borderBottomWidth: 0 },
  factValue: { fontSize: 14, flexShrink: 1, textAlign: "right" },
  genres: {},
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chaptersHead: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    paddingTop: 20,
  },
  chaptersTitleRow: { paddingHorizontal: 20, gap: 4 },
  chaptersTitle: { fontSize: 18, fontWeight: "600" },
  chaptersTitleLine: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  note: { fontSize: 12, color: colors.mutedForeground },
  progressBlock: { paddingHorizontal: 20, paddingTop: 12 },
  track: { height: 6, borderRadius: radius.full, backgroundColor: colors.secondary, overflow: "hidden" },
  fill: { height: 6, backgroundColor: colors.primary },
  progressText: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  tabs: { marginTop: 16, borderBottomWidth: 1, borderColor: colors.border, flexGrow: 0 },
  tabsContent: { paddingHorizontal: 20, gap: 4 },
  tab: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 2, borderColor: "transparent" },
  tabOn: { borderColor: colors.primary },
  tabText: { fontSize: 14, color: colors.mutedForeground },
  tabTextOn: { color: colors.foreground },
  tabRange: { fontSize: 10, color: colors.mutedForeground },
  legend: { flexDirection: "row", gap: 16, paddingHorizontal: 20, paddingVertical: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderLeftColor: colors.border,
    borderRightColor: colors.border,
    borderTopColor: colors.borderSoft,
    paddingRight: 16,
  },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 20 },
  rowPressed: { backgroundColor: "rgba(38,38,38,0.5)" },
  num: { width: 44, fontSize: 14, color: colors.mutedForeground },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.secondary,
  },
  badgeText: { fontSize: 11, color: colors.foreground },
  chaptersFoot: {
    height: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
    borderBottomLeftRadius: radius["2xl"],
    borderBottomRightRadius: radius["2xl"],
  },
  emptyRow: {
    backgroundColor: colors.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    padding: 32,
    alignItems: "center",
  },
});
