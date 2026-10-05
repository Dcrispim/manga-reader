import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "../../../db/liveQuery";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { chapterRows, q } from "../../../catalog/queries";
import { db } from "../../../db/client";
import { enqueueAndDrain } from "../../../jobs/drain";
import { createClient } from "../../../net/client";
import { PageImage } from "../../../reader/PageImage";
import { UnavailableChapter } from "../../../reader/UnavailableChapter";
import { ZoomableList } from "../../../reader/ZoomableList";
import { nextChapter } from "../../../reader/nextChapter";
import { useChapter } from "../../../reader/useChapter";
import { useServerStatus } from "../../../server/useServerStatus";
import { expoFileStore } from "../../../storage/files";

const client = createClient({ db });

export default function ReaderScreen() {
  const { title, chapter } = useLocalSearchParams<{ title: string; chapter: string }>();
  const router = useRouter();
  const { status } = useServerStatus();
  const online = status === "online";

  const { data: sources } = useLiveQuery(q.sources(db, title), [title]);
  const { data: dls } = useLiveQuery(q.titleDownloads(db, title), [title]);
  const { data: jobRows } = useLiveQuery(q.titleJobs(db, title), [title]);

  const chapters = useMemo(
    () =>
      chapterRows(
        { sources: sources ?? [], downloads: dls ?? [], transient: [], jobs: [], history: [] },
        true,
      ).map((r) => r.chapter),
    [sources, dls],
  );
  const { next, skipped } = useMemo(() => nextChapter(chapters, chapter), [chapters, chapter]);

  const { state, quality, setQuality, xlAvailable } = useChapter({
    db,
    client,
    files: expoFileStore,
    title,
    chapter,
    next,
    online,
  });

  // Failed pages retry on their own when the server comes back.
  const [retryToken, setRetryToken] = useState(0);
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) setRetryToken((n) => n + 1);
    wasOnline.current = online;
  }, [online]);

  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const job = (jobRows ?? []).find((j) => j.kind === "download" && j.chapter === chapter) ?? null;

  const goTo = (target: string) =>
    router.replace({ pathname: "/read/[title]/[chapter]", params: { title, chapter: target } });

  const goNext = () => {
    if (!next) return;
    if (skipped.length === 0) return goTo(next);
    Alert.alert(`Pular capítulos ${skipped.join(", ")}?`, undefined, [
      { text: "Cancelar", style: "cancel" },
      { text: "Pular", onPress: () => goTo(next) },
    ]);
  };

  const header = <Stack.Screen options={{ title: `${title} · ${chapter}` }} />;

  if (state.status === "unavailable") {
    return (
      <View style={styles.root}>
        {header}
        <UnavailableChapter
          job={job}
          onDownload={() => enqueueAndDrain(db, "download", title, chapter)}
          onBack={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {header}
      {state.status === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ZoomableList>
          <FlatList
            data={state.pages}
            keyExtractor={(p) => `${quality}-${p.index}`}
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            removeClippedSubviews
            renderItem={({ item }) => (
              <PageImage
                testID={`page-${item.index}`}
                uri={item.uri}
                pending={item.pending}
                fallbackAspect={aspect}
                retryToken={retryToken}
                onAspect={setAspect}
              />
            )}
            ListFooterComponent={
              next ? (
                <Pressable accessibilityRole="button" onPress={goNext} style={styles.next}>
                  <Text style={styles.nextText}>{`Próximo capítulo (${next})`}</Text>
                </Pressable>
              ) : (
                <Text style={styles.end}>Fim</Text>
              )
            }
          />
        </ZoomableList>
      )}
      {xlAvailable && online ? (
        <View style={styles.bar}>
          <Pressable accessibilityRole="button" onPress={() => setQuality("original")}>
            <Text style={quality === "original" ? styles.on : styles.off}>Original</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setQuality("xl")}>
            <Text style={quality === "xl" ? styles.on : styles.off}>Upscaled</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  next: { padding: 20, alignItems: "center", backgroundColor: "#111" },
  nextText: { color: "#6aa7ff", fontSize: 15 },
  end: { color: "#888", textAlign: "center", padding: 20 },
  bar: { flexDirection: "row", justifyContent: "center", gap: 24, padding: 10, backgroundColor: "#111" },
  on: { color: "#fff", fontWeight: "700" },
  off: { color: "#888" },
});
