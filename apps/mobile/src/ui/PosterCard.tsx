import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { displayName } from './displayName';
import { Text } from './Text';
import { TitleCover } from './TitleCover';
import { colors, radius } from './theme';

/**
 * The web's PreviewCard: a 2:3 cover with the name and chapter count over a
 * bottom gradient, and an optional "Cap. N" badge (Continuar Lendo).
 */
export const PosterCard = memo(function PosterCard({
  name,
  thumbPath,
  caps,
  badge,
  width,
  testID,
  href,
}: {
  name: string;
  thumbPath: string | null;
  caps?: number;
  badge?: string;
  width: number;
  testID?: string;
  href?: { pathname: '/title/[name]'; params: { name: string } } | { pathname: '/read/[title]/[chapter]'; params: { title: string; chapter: string } };
}) {
  return (
    // asChild: a plain Link renders a Text, which collapses the card. Its Slot
    // merges styles and loses array or function styles, so pass one flat object.
    // Explicit height: in a horizontal list, aspectRatio loses to the stretch.
    <Link href={href ?? { pathname: '/title/[name]', params: { name } }} asChild>
      {/* testID and label on the whole card: E2E flows find it even when the
          name at the bottom is below the fold, and read the title from it. */}
      <Pressable
        style={StyleSheet.flatten([styles.card, { width, height: width * 1.5 }])}
        testID={testID}
        accessibilityLabel={displayName(name)}
      >
        <TitleCover name={name} thumbPath={thumbPath} style={styles.cover} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.footer}>
          <Text numberOfLines={1} style={styles.name}>
            {displayName(name)}
          </Text>
          {caps !== undefined ? <Text style={styles.caps}>{`${caps} caps`}</Text> : null}
        </LinearGradient>
      </Pressable>
    </Link>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.card },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, aspectRatio: undefined, borderRadius: 0 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.badge,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8, paddingTop: 24 },
  name: { color: '#fff', fontSize: 14, fontWeight: '500' },
  caps: { color: colors.gray400, fontSize: 12 },
});
