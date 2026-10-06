import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "../../../db/liveQuery";
import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { FlatList as GHFlatList } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { chapterRows, q } from "../../../catalog/queries";
import { db } from "../../../db/client";
import { enqueueAndDrain } from "../../../jobs/drain";
import { createClient } from "../../../net/client";
import { PageImage } from "../../../reader/PageImage";
import { ReaderMenu } from "../../../reader/ReaderMenu";
import { PullIndicator, PullToNextArea, usePullToNext } from "../../../reader/PullToNext";
import { UnavailableChapter } from "../../../reader/UnavailableChapter";
import { ZoomableList } from "../../../reader/ZoomableList";
import { nextChapter } from "../../../reader/nextChapter";
import { useChapter } from "../../../reader/useChapter";
import { useServerStatus } from "../../../server/useServerStatus";
import { expoFileStore } from "../../../storage/files";
import { getSetting } from "../../../settings/repo";
import { IconButton } from "../../../ui/Button";
import { ServerStatusPill } from "../../../ui/ServerStatusPill";
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
  const { data: hist } = useLiveQuery(q.titleHistory(db, title), [title]);

  const chapters = useMemo(
    () =>
      chapterRows(
        { sources: sources ?? [], downloads: dls ?? [], transient: [], jobs: [], history: [] },
        true,
      ).map((r) => r.chapter),
    [sources, dls],
  );
  const { next, skipped } = useMemo(() => nextChapter(chapters, chapter), [chapters, chapter]);
  const upcoming = useMemo(() => {
    const cur = parseFloat(chapter);
    return chapters.filter((c) => parseFloat(c) > cur);
  }, [chapters, chapter]);
  const prev = useMemo(() => {
    const cur = parseFloat(chapter);
    const before = chapters.filter((c) => parseFloat(c) < cur);
    return before.length ? before[before.length - 1] : null;
  }, [chapters, chapter]);
  const readOpenedAt = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hist ?? []) m.set(h.chapter, Math.max(m.get(h.chapter) ?? 0, h.openedAt));
    return m;
  }, [hist]);
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  const { state, quality, setQuality, xlAvailable } = useChapter({
    db,
    client,
    files: expoFileStore,
    title,
    chapter,
    upcoming,
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

  // Header and footer slide away while scrolling down and come back on any
  // scroll up (or near the top), like a reading app should.
  const [chrome] = useState(() => new Animated.Value(1));
  const [chromeVisible, setChromeVisible] = useState(true);
  const lastY = useRef(0);
  useEffect(() => {
    Animated.timing(chrome, { toValue: chromeVisible ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [chromeVisible, chrome]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    lastY.current = y;
    if (y < 48) setChromeVisible(true);
    else if (dy > 6) setChromeVisible(false);
    else if (dy < -6) setChromeVisible(true);
  };
  const headerHeight = insets.top + 56;
  // "Puxar para o próximo capítulo" can be turned off in Settings.
  const [pullEnabled] = useState(() => getSetting(db, 'reader.pullNext') !== 'false');
  const pullNext = usePullToNext({ next, onNext: goNext, enabled: pullEnabled });
  const showBar = xlAvailable && online;

  const header = (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            height: headerHeight,
            transform: [{ translateY: chrome.interpolate({ inputRange: [0, 1], outputRange: [-headerHeight, 0] }) }],
          },
        ]}
      >
        <IconButton icon="arrow-left" label="Voltar" color={colors.foreground} size={22} onPress={() => router.back()} />
        <Text style={styles.headerTitle} numberOfLines={1}>{`${displayName(title)} · Cap. ${chapter}`}</Text>
        <ServerStatusPill status={status} />
      </Animated.View>
    </>
  );

  const menu = (
    <>
      {/* The menu button hides with the header while scrolling down. */}
      <Animated.View
        pointerEvents={chromeVisible ? "auto" : "none"}
        style={[
          styles.fab,
          {
            bottom: insets.bottom + 16,
            opacity: chrome,
            transform: [{ translateY: chrome.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) }],
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir menu"
          onPress={() => setMenuOpen(true)}
          style={styles.fabButton}
        >
          <Feather name="menu" size={20} color={colors.foreground} />
        </Pressable>
      </Animated.View>
      <ReaderMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={title}
        chapter={chapter}
        chapters={chapters}
        next={next}
        prev={prev}
        readOpenedAt={readOpenedAt}
        quality={quality}
        xlAvailable={showBar}
        onQuality={setQuality}
        onChapter={goTo}
        onTitle={() => router.dismissTo({ pathname: "/title/[name]", params: { name: title } })}
        onHome={() => router.dismissTo("/")}
      />
    </>
  );

  if (state.status === "unavailable") {
    return (
      <View style={styles.root}>
        {header}
        <View style={{ flex: 1, paddingTop: headerHeight }}>
          <UnavailableChapter
            job={job}
            onDownload={() => enqueueAndDrain(db, "download", title, chapter)}
            onBack={() => router.back()}
          />
        </View>
        {menu}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {state.status === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : (
        <ZoomableList>
          <PullToNextArea pan={pullNext.pan} contentStyle={pullNext.contentStyle}>
          <GHFlatList
            simultaneousHandlers={pullNext.panRef}
            data={state.pages}
            keyExtractor={(p) => `${quality}-${p.index}`}
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            removeClippedSubviews
            onScroll={(e) => {
              onScroll(e);
              pullNext.onScroll(e);
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingTop: headerHeight }}
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
              // The web's end strip: one thin line; tap it, or keep pulling up, for the next chapter.
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={next ? `Fim. Ir para o capítulo ${next}` : "Fim"}
                disabled={!next}
                onPress={goNext}
                style={[styles.endStrip, { marginBottom: insets.bottom }]}
              >
                <Text style={styles.endText}>FIM</Text>
              </Pressable>
            }
          />
          </PullToNextArea>
        </ZoomableList>
      )}
      <PullIndicator pull={pullNext.pull} next={next} bottom={insets.bottom} />
      {header}
      {showBar ? (
        <Animated.View
          style={[
            styles.bar,
            {
              bottom: insets.bottom + 16,
              opacity: chrome,
              transform: [{ translateY: chrome.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
            },
          ]}
          pointerEvents={chromeVisible ? "auto" : "none"}
        >
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
        </Animated.View>
      ) : null}
      {menu}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600" },
  endStrip: { alignItems: "center", paddingVertical: 6 },
  endText: { fontSize: 12, fontWeight: "600", letterSpacing: 2, color: colors.mutedForeground },
  bar: {
    position: "absolute",
    flexDirection: "row",
    alignSelf: "center",
    gap: 4,
    padding: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  seg: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.full },
  segOn: { backgroundColor: colors.primary },
  on: { color: colors.primaryForeground, fontWeight: "600", fontSize: 13 },
  off: { color: colors.mutedForeground, fontSize: 13 },
  fab: {
    position: "absolute",
    right: 16,
    width: 48,
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  fabButton: { flex: 1, alignItems: "center", justifyContent: "center" },
});
