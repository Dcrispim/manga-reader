import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../ui/Button';
import { Label } from '../ui/Card';
import { displayName } from '../ui/displayName';
import { Text } from '../ui/Text';
import { colors, radius } from '../ui/theme';

const LAST_READ_COUNT = 4;
const CLOSE_MS = 220;
const CELL_W = 56;
const CELL_H = 44;
const GAP = 10;

/**
 * The web reader's side menu (SidebarDrawer + GridView) as a drawer from the
 * right: next / title / home / previous, the reading settings, the chapter
 * grid (by chapter or by blocks of 100) and the last chapters read.
 */
export function ReaderMenu({
  open,
  onClose,
  title,
  chapter,
  chapters,
  next,
  prev,
  readOpenedAt,
  quality,
  xlAvailable,
  onQuality,
  onChapter,
  onTitle,
  onHome,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  chapter: string;
  /** Ascending. */
  chapters: string[];
  next: string | null;
  prev: string | null;
  /** chapter -> last open time, from history. */
  readOpenedAt: Map<string, number>;
  quality: 'original' | 'xl';
  xlAvailable: boolean;
  onQuality: (q: 'original' | 'xl') => void;
  onChapter: (chapter: string) => void;
  onTitle: () => void;
  onHome: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(340, width * 0.85);
  // A lazily created value, not a ref: refs must not be read during render.
  const [slide] = useState(() => new Animated.Value(0));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<'chapters' | 'volume'>('chapters');
  const [block, setBlock] = useState<number | null>(null);
  // Built on first open only: a long title has thousands of chapters.
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);

  // Once built it stays mounted: closed, it sits off screen and ignores touches.
  useEffect(() => {
    Animated.timing(slide, { toValue: open ? 1 : 0, duration: CLOSE_MS, useNativeDriver: true }).start();
  }, [open, slide]);

  const blocks = useMemo(
    () => [...new Set(chapters.map((c) => Math.floor(parseFloat(c) / 100)))].filter(Number.isFinite),
    [chapters],
  );
  const shown = useMemo(
    () =>
      mode === 'volume' && block !== null
        ? chapters.filter((c) => Math.floor(parseFloat(c) / 100) === block)
        : chapters,
    [chapters, mode, block],
  );
  const lastRead = useMemo(
    () =>
      [...readOpenedAt.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, LAST_READ_COUNT)
        .map(([c]) => c),
    [readOpenedAt],
  );

  if (!rendered) return null;

  const cols = Math.max(3, Math.floor((panelWidth - 32 + GAP) / (CELL_W + GAP)));
  const gridItems: { key: string; block?: number; chapter?: string }[] =
    mode === 'volume' && block === null
      ? blocks.map((b) => ({ key: `b${b}`, block: b }))
      : shown.map((c) => ({ key: c, chapter: c }));
  const currentIndex = gridItems.findIndex((g) => g.chapter === chapter);
  const initialRow = currentIndex >= 0 ? Math.max(0, Math.floor(currentIndex / cols) - 2) : 0;

  // Close first and navigate once the slide-out ended: unmounting the screen
  // mid-animation (native driver) crashes Fabric ("child already has a parent").
  const go = (action: () => void) => {
    onClose();
    setTimeout(action, CLOSE_MS + 40);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar menu" />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            paddingTop: insets.top + 8,
            transform: [
              { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.closeRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" hitSlop={10} onPress={onClose}>
            <Feather name="x" size={20} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.nav}>
            {next ? (
              <Button variant="outline" label="Próximo" onPress={() => go(() => onChapter(next))} style={styles.full} />
            ) : null}
            <Button variant="outline" label={displayName(title)} onPress={() => go(onTitle)} style={styles.full} />
            <Button variant="outline" label="Início" onPress={() => go(onHome)} style={styles.full} />
            {prev ? (
              <Button variant="outline" label="Anterior" onPress={() => go(() => onChapter(prev))} style={styles.full} />
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: settingsOpen }}
            onPress={() => setSettingsOpen((v) => !v)}
            style={styles.settingsHead}
          >
            <Feather name="settings" size={16} color={colors.mutedForeground} />
            <Text style={styles.settingsText}>Configurações</Text>
            <Feather name={settingsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </Pressable>
          {settingsOpen ? (
            <View style={styles.settingsBody}>
              <Label>Qualidade</Label>
              {xlAvailable ? (
                <View style={styles.seg}>
                  {(['original', 'xl'] as const).map((q) => (
                    <Pressable
                      key={q}
                      accessibilityRole="button"
                      onPress={() => onQuality(q)}
                      style={[styles.segItem, quality === q && styles.segOn]}
                    >
                      <Text style={quality === q ? styles.segTextOn : styles.segText}>
                        {q === 'original' ? 'Original' : 'Upscaled'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>Só a versão original está disponível.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.modes}>
            {(['chapters', 'volume'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="radio"
                accessibilityState={{ checked: mode === m }}
                onPress={() => {
                  setMode(m);
                  setBlock(null);
                }}
                style={styles.mode}
              >
                <View style={[styles.radio, mode === m && styles.radioOn]} />
                <Text>{m === 'chapters' ? 'Capítulos' : 'Volume'}</Text>
              </Pressable>
            ))}
          </View>

          <FlatList
            key={`${cols}-${mode}-${block}`}
            style={styles.gridBox}
            nestedScrollEnabled
            data={gridItems}
            numColumns={cols}
            keyExtractor={(g) => g.key}
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={{ gap: GAP }}
            initialNumToRender={cols * 8}
            // With numColumns the list is virtualized by row: both the initial
            // index and the layouts below count rows, not items.
            initialScrollIndex={initialRow}
            getItemLayout={(_, row) => ({ length: CELL_H + GAP, offset: (CELL_H + GAP) * row, index: row })}
            renderItem={({ item }) => {
              if (item.block !== undefined) {
                const b = item.block;
                return (
                  <Pressable accessibilityRole="button" onPress={() => setBlock(b)} style={[styles.cell, styles.cellWide]}>
                    <Text style={styles.cellText}>{`${b * 100}–${b * 100 + 99}`}</Text>
                  </Pressable>
                );
              }
              const c = item.chapter!;
              const current = c === chapter;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Capítulo ${c}`}
                  onPress={() => go(() => onChapter(c))}
                  style={[styles.cell, readOpenedAt.has(c) && styles.cellRead, current && styles.cellCurrent]}
                >
                  <Text style={[styles.cellText, current && styles.cellTextCurrent]}>{String(parseFloat(c))}</Text>
                </Pressable>
              );
            }}
          />

          {lastRead.length ? (
            <View style={styles.last}>
              <Text style={styles.lastTitle}>Últimos capítulos lidos</Text>
              {lastRead.map((c) => (
                <Pressable key={c} accessibilityRole="link" onPress={() => go(() => onChapter(c))}>
                  <Text style={styles.lastLink}>{`Capítulo ${c}`}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderLeftWidth: 1,
    borderColor: colors.border,
  },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 },
  content: { paddingHorizontal: 16, gap: 16 },
  nav: { gap: 8 },
  full: { alignSelf: 'stretch', borderRadius: radius.md },
  settingsHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  settingsText: { flex: 1, color: colors.mutedForeground, fontSize: 15 },
  settingsBody: { gap: 8, paddingLeft: 24 },
  seg: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 4,
    padding: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segItem: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full },
  segOn: { backgroundColor: colors.primary },
  segText: { fontSize: 13, color: colors.mutedForeground },
  segTextOn: { fontSize: 13, color: colors.primaryForeground, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.mutedForeground },
  modes: { flexDirection: 'row', justifyContent: 'space-around' },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.mutedForeground },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  gridBox: { maxHeight: 384 },
  cell: {
    width: CELL_W,
    height: CELL_H,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWide: { width: 92 },
  cellRead: { backgroundColor: '#374151' },
  cellCurrent: { backgroundColor: colors.gray300, borderColor: colors.gray300 },
  cellText: { fontSize: 14 },
  cellTextCurrent: { color: '#111827' },
  last: { gap: 6 },
  lastTitle: { fontSize: 18, fontWeight: '600' },
  lastLink: { fontSize: 15, color: '#5b8def', paddingVertical: 2 },
});
