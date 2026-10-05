import { Image } from 'expo-image';

// The app mark (assets/images/use-esta-imagem.png, white on transparent):
// the same artwork as the launcher icon, the splash and the web favicon.
const MARK = require('../../assets/images/logo-mark.png');

export function Logo({ size = 28, opacity = 1 }: { size?: number; opacity?: number }) {
  // The mark is 667x721, slightly taller than wide.
  return <Image source={MARK} style={{ width: size * 0.925, height: size, opacity }} contentFit="contain" />;
}
