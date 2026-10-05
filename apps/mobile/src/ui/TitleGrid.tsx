import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { gridColumns, type CatalogTitle } from '../catalog/queries';
import { PosterCard } from './PosterCard';

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
  return (
    <FlatList
      // FlatList cannot change numColumns on the fly: a new key remounts it.
      key={cols}
      data={items}
      numColumns={cols}
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
