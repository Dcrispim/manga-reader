import { Stack, useLocalSearchParams } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { badgeLabel, buildCatalog, chapterRows, q, type ChapterRow } from "../../catalog/queries";
import { db } from "../../db/client";
import { enqueueAndDrain } from "../../jobs/drain";
import { createClient } from "../../net/client";
import { hasFeature } from "../../server/status";
import { useServerStatus } from "../../server/useServerStatus";
import { deleteChapter } from "../../storage/downloads";
import { expoFileStore } from "../../storage/files";
import { syncTitleOnDemand } from "../../sync/catalog";
import { TitleCover } from "../../ui/TitleCover";

const META_LABELS: [keyof ReturnType<typeof metaOf>, string][] = [
  ["author", "Autor"],
  ["status", "Status"],
  ["type", "Tipo"],
  ["demographic", "Demografia"],
  ["published", "Publicado"],
  ["volumes", "Volumes"],
];

function metaOf(m: Record<string, string | undefined>) {
  return {
    author: m.author || m.authors,
    status: m.status,
    type: m.type,
    demographic: m.demographic,
    published: m.published,
    volumes: m.volumes,
  };
}

export default function TitleScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { status } = useServerStatus();
  const [ascending, setAscending] = useState(false);

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

  const title = useMemo(
    () => buildCatalog(titleRows ?? [], counts ?? [])[0],
    [titleRows, counts],
  );
  const rows = useMemo(
    () =>
      chapterRows(
        {
          sources: sources ?? [],
          downloads: dls ?? [],
          transient: transient ?? [],
          jobs: jobRows ?? [],
          history: hist ?? [],
        },
        ascending,
      ),
    [sources, dls, transient, jobRows, hist, ascending],
  );
  const online = status === "online";
  const meta = metaOf((title?.meta ?? {}) as Record<string, string | undefined>);

  const header = (
    <View style={styles.header}>
      <View style={styles.coverWrap}>
        <TitleCover name={name} thumbPath={title?.thumbPath ?? null} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{name}</Text>
        {META_LABELS.map(([k, label]) =>
          meta[k] ? (
            <Text key={k} style={styles.meta}>{`${label}: ${meta[k]}`}</Text>
          ) : null,
        )}
        {title && title.categories.length > 0 ? (
          <Text style={styles.meta}>{title.categories.join(", ")}</Text>
        ) : null}
        {title?.meta.description ? (
          <Text style={styles.desc}>{title.meta.description}</Text>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => setAscending((a) => !a)}>
          <Text style={styles.link}>
            {ascending ? "Ordem: menor para maior" : "Ordem: maior para menor"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: name }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.chapter}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum capítulo disponível</Text>}
        renderItem={({ item }) => <ChapterItem title={name} row={item} online={online} />}
      />
    </View>
  );
}

function ChapterItem({ title, row, online }: { title: string; row: ChapterRow; online: boolean }) {
  const label = badgeLabel(row.badge);
  const canDownload = row.onServer && (row.badge.kind === "none" || row.badge.kind === "cached");
  return (
    <View style={[styles.row, row.read && styles.rowRead]}>
      <View style={{ flex: 1 }}>
        <Text>{`Capítulo ${row.chapter}${row.pages ? ` · ${row.pages} págs.` : ""}`}</Text>
        {label ? <Text style={styles.badge}>{label}</Text> : null}
      </View>
      {canDownload ? (
        <Pressable accessibilityRole="button" onPress={() => enqueueAndDrain(db, "download", title, row.chapter)}>
          <Text style={styles.link}>{online ? "Baixar" : "Baixar quando disponível"}</Text>
        </Pressable>
      ) : null}
      {row.badge.kind === "downloaded" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void deleteChapter(db, expoFileStore, title, row.chapter)}
        >
          <Text style={styles.link}>Remover download</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 12, padding: 12 },
  coverWrap: { width: 110 },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: "700" },
  meta: { fontSize: 12, color: "#666" },
  desc: { fontSize: 13, marginTop: 4 },
  link: { color: "#1b6fe0", fontSize: 13, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#bbb" },
  rowRead: { opacity: 0.6 },
  badge: { fontSize: 11, color: "#2e7d4f" },
  empty: { padding: 24, textAlign: "center" },
});
