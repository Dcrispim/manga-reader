import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

/** Aspect (width / height) used for a page that has not loaded or has failed. */
export const DEFAULT_ASPECT = 0.7;

interface Props {
  uri: string;
  /** The page is still downloading into the cache: hold its place, load nothing. */
  pending?: boolean;
  /** Last aspect seen in this chapter; keeps a failed page about the right height. */
  fallbackAspect?: number;
  /** Bumped by the screen when the server turns online, to retry failed pages. */
  retryToken?: number;
  onAspect?: (aspect: number) => void;
  /** Lets E2E flows find a given page (e.g. page-0). */
  testID?: string;
}

/**
 * One page. Full width, height from the real aspect after onLoad. A failed
 * load shows a quiet placeholder; tapping it (or the server coming back)
 * retries. Never an alert or a toast.
 */
export const PageImage = memo(function PageImage({ uri, pending = false, fallbackAspect, retryToken = 0, onAspect, testID }: Props) {
  const { width } = useWindowDimensions();
  const [aspect, setAspect] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lastToken, setLastToken] = useState(retryToken);

  // Retry once per token change (adjusting state during render is the React way
  // to derive state from props without an extra effect pass).
  if (lastToken !== retryToken) {
    setLastToken(retryToken);
    if (failed) {
      setFailed(false);
      setAttempt((n) => n + 1);
    }
  }

  const height = width / (aspect ?? fallbackAspect ?? DEFAULT_ASPECT);

  if (pending) {
    return (
      <View style={[styles.placeholder, { width, height }]} testID={testID}>
        <ActivityIndicator color="#bbb" />
      </View>
    );
  }

  if (failed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Toque para tentar de novo"
        onPress={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
        style={[styles.placeholder, { width, height }]}
      >
        <Text style={styles.text}>Toque para tentar de novo</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ width, height }} testID={testID}>
      <Image
        key={attempt}
        source={{ uri }}
        // Local files need no second copy in expo-image's disk cache.
        cachePolicy={uri.startsWith('http') ? 'disk' : 'memory'}
        contentFit="contain"
        style={styles.fill}
        onLoad={(e) => {
          const { width: w, height: h } = e.source;
          if (w > 0 && h > 0) {
            setAspect(w / h);
            onAspect?.(w / h);
          }
        }}
        onError={() => setFailed(true)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#222' },
  text: { color: '#bbb', fontSize: 14 },
});
