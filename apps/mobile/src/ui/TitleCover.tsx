import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Placeholder } from './Placeholder';

/** Cover from the local file; the placeholder covers a null path or a broken image. */
export function TitleCover({
  name,
  thumbPath,
  style,
}: {
  name: string;
  thumbPath: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  // Remember which path failed, so a new cover (new path) gets a fresh try.
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = thumbPath !== null && failed !== thumbPath;
  return (
    <View style={[styles.box, style]}>
      {showImage ? (
        <Image
          source={{ uri: thumbPath }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setFailed(thumbPath)}
        />
      ) : (
        <Placeholder name={name} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { aspectRatio: 2 / 3, borderRadius: 6, overflow: 'hidden', backgroundColor: '#171717' },
});
