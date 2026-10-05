import { forwardRef } from 'react';
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { colors, fonts } from './theme';

// Android does not pick a weight out of a custom family, so each weight is its
// own font file: fontWeight in a style is mapped to the matching Geist face.
function familyFor(weight: unknown): string {
  switch (String(weight ?? '400')) {
    case '500':
      return fonts.medium;
    case '600':
      return fonts.semibold;
    case '700':
    case '800':
    case '900':
    case 'bold':
      return fonts.bold;
    default:
      return fonts.regular;
  }
}

/** Text in the app's type: Geist, foreground color by default. */
export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  const flat = StyleSheet.flatten(style) ?? {};
  return (
    <RNText
      ref={ref}
      {...rest}
      style={[
        styles.base,
        flat,
        { fontFamily: flat.fontFamily ?? familyFor(flat.fontWeight), fontWeight: undefined },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  base: { color: colors.foreground, fontSize: 14 },
});
