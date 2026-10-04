import { Link } from 'expo-router';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { gridColumns, type CatalogTitle } from '../catalog/queries';
import { TitleCover } from './TitleCover';

const GAP = 8;

export function TitleGrid({
  items,
  header,
}: {
  items: CatalogTitle[];
  header?: React.ReactElement;
}) {
  const { width } = useWindowDimensions();
  const cols = gridColumns(width);
  const itemWidth = (width - GAP * (cols + 1)) / cols;
  return (
    <FlatList
      // FlatList cannot change numColumns on the fly: a new key remounts it.
      key={cols}
      data={items}
      numColumns={cols}
      keyExtractor={(t) => t.name}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: GAP / 2 }}
      renderItem={({ item }) => (
        <View style={{ width: itemWidth, margin: GAP / 2 }}>
          <Link href={{ pathname: '/title/[name]', params: { name: item.name } }}>
            <View style={{ width: itemWidth }}>
              <TitleCover name={item.name} thumbPath={item.thumbPath} />
              <Text numberOfLines={2} style={styles.name}>
                {item.name}
              </Text>
            </View>
          </Link>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 12, marginTop: 4 },
});
