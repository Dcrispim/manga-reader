import { FlatList, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';

import { gridColumns, type CatalogTitle } from '../catalog/queries';
import { usePullRefresh } from '../sync/usePullRefresh';
import { PosterCard } from './PosterCard';
import { colors } from './theme';

const GAP = 12;
const PAD = 16;

export function TitleGrid({
  items,
  header,
}: {
  items: CatalogTitle[];
  header?: React.ReactElement;
}) {
  const { width } = useWindowDimensions();
  const cols = gridColumns(width);
  const itemWidth = Math.floor((width - PAD * 2 - GAP * (cols - 1)) / cols);
  const { refreshing, onRefresh } = usePullRefresh();
  return (
    <FlatList
      // FlatList cannot change numColumns on the fly: a new key remounts it.
      key={cols}
      data={items}
      numColumns={cols}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primaryForeground]}
          progressBackgroundColor={colors.primary}
        />
      }
      keyExtractor={(t) => t.name}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      columnWrapperStyle={cols > 1 ? { gap: GAP } : undefined}
      renderItem={({ item }) => (
        <View style={{ width: itemWidth }}>
          <PosterCard name={item.name} thumbPath={item.thumbPath} caps={item.caps} width={itemWidth} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: PAD, gap: GAP },
});
