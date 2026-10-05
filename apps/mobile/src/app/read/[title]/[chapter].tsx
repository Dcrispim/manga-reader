import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "../../../db/liveQuery";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from "react-native";

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
import { Button } from "../../../ui/Button";
import { displayName } from "../../../ui/displayName";
import { Text } from "../../../ui/Text";
import { colors, radius } from "../../../ui/theme";

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

  const header = (
    <Stack.Screen
      options={{ title: `${displayName(title)} · Cap. ${chapter}`, headerStyle: { backgroundColor: colors.black } }}
    />
  );

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
          <ActivityIndicator color={colors.mutedForeground} />
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
                <View style={styles.next}>
                  <Button label={`Próximo capítulo (${next})`} icon="arrow-right" onPress={goNext} />
                </View>
              ) : (
                <Text style={styles.end}>Fim</Text>
              )
            }
          />
        </ZoomableList>
      )}
      {xlAvailable && online ? (
        <View style={styles.bar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setQuality("original")}
            style={[styles.seg, quality === "original" && styles.segOn]}
          >
            <Text style={quality === "original" ? styles.on : styles.off}>Original</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setQuality("xl")}
            style={[styles.seg, quality === "xl" && styles.segOn]}
          >
            <Text style={quality === "xl" ? styles.on : styles.off}>Upscaled</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  next: { paddingVertical: 32, alignItems: "center" },
  end: { color: colors.mutedForeground, textAlign: "center", padding: 32 },
  bar: {
    flexDirection: "row",
    alignSelf: "center",
    gap: 4,
    padding: 4,
    margin: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  seg: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.full },
  segOn: { backgroundColor: colors.primary },
  on: { color: colors.primaryForeground, fontWeight: "600", fontSize: 13 },
  off: { color: colors.mutedForeground, fontSize: 13 },
});
