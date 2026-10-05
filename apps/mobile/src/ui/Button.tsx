import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, radius } from './theme';

type Variant = 'primary' | 'outline' | 'white' | 'ghost' | 'danger';

/**
 * Pill buttons as on the web: primary (light fill), outline (thin border),
 * white (the home hero), ghost (text only) and danger (outlined red).
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  small,
  style,
  testID,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Feather>['name'];
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        v.box,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {icon ? <Feather name={icon} size={small ? 14 : 16} color={v.text.color} /> : null}
        <Text style={[styles.text, small && styles.smallText, v.text]}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Round icon-only button (header actions, row actions). */
export function IconButton({
  icon,
  onPress,
  label,
  color = colors.mutedForeground,
  size = 18,
  testID,
  bordered,
}: {
  icon: ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  testID?: string;
  bordered?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.icon, bordered && styles.iconBordered, pressed && styles.pressed]}
    >
      <Feather name={icon} size={size} color={color} />
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { box: ViewStyle; text: { color: string } }> = {
  primary: { box: { backgroundColor: colors.primary }, text: { color: colors.primaryForeground } },
  outline: { box: { borderWidth: 1, borderColor: colors.border }, text: { color: colors.foreground } },
  white: { box: { backgroundColor: '#ffffff', borderRadius: radius.md }, text: { color: '#000000' } },
  ghost: { box: {}, text: { color: colors.mutedForeground } },
  danger: { box: { borderWidth: 1, borderColor: 'rgba(255,100,103,0.4)' }, text: { color: colors.destructive } },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 14, fontWeight: '600' },
  smallText: { fontSize: 12, fontWeight: '500' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  icon: { padding: 6, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  iconBordered: { borderWidth: 1, borderColor: colors.border, padding: 8 },
});
