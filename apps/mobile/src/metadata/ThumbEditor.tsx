import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image as RNImage, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { db } from '../db/client';
import { Button, IconButton } from '../ui/Button';
import { common } from '../ui/SettingsBits';
import { Text } from '../ui/Text';
import { colors, radius } from '../ui/theme';
import { uploadThumb } from './api';

// Same output as the web editor: a 2:3 crop saved as a 800x1200 JPEG.
const OUT_W = 800;
const OUT_H = 1200;
const MAX_ZOOM = 5;
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36 manga-reader';

type Loaded = { uri: string; w: number; h: number };

const getSize = (uri: string) =>
  new Promise<{ w: number; h: number }>((resolve, reject) =>
    RNImage.getSize(uri, (w, h) => resolve({ w, h }), reject),
  );

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * The app's cover editor: an image from a link, the gallery or the clipboard,
 * panned and pinched inside a 2:3 frame, cropped on the device and uploaded
 * as .thumb/<title>.jpg.
 */
export function ThumbEditor({
  title,
  onSaved,
  onCancel,
}: {
  title: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { width } = useWindowDimensions();
  const frameW = Math.min(280, width - 64);
  const frameH = frameW * 1.5;
  const [link, setLink] = useState('');
  const [image, setImage] = useState<Loaded | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [start, setStart] = useState({ x: 0, y: 0, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const base = image ? Math.max(frameW / image.w, frameH / image.h) : 1;
  const scale = base * zoom;
  const iw = image ? image.w * scale : 0;
  const ih = image ? image.h * scale : 0;
  const clampAt = (o: { x: number; y: number }, z: number) => {
    const w = image ? image.w * base * z : 0;
    const h = image ? image.h * base * z : 0;
    return {
      x: Math.max(-(w - frameW) / 2, Math.min((w - frameW) / 2, o.x)),
      y: Math.max(-(h - frameH) / 2, Math.min((h - frameH) / 2, o.y)),
    };
  };
  const pos = clampAt(offset, zoom);
  const left = frameW / 2 - iw / 2 + pos.x;
  const top = frameH / 2 - ih / 2 + pos.y;

  async function openImage(uri: string) {
    try {
      const { w, h } = await getSize(uri);
      setImage({ uri, w, h });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setMessage(null);
    } catch {
      setMessage('Não foi possível abrir essa imagem.');
    }
  }

  async function fromLink(url: string) {
    if (!/^https?:\/\//.test(url.trim())) {
      setMessage('Informe um link http(s) para a imagem.');
      return;
    }
    setBusy(true);
    try {
      const dest = new File(Paths.cache, `thumb-src-${Date.now()}`);
      // Some hosts (Wikimedia, CDNs) refuse OkHttp's default agent.
      const file = await File.downloadFileAsync(url.trim(), dest, {
        idempotent: true,
        headers: { 'User-Agent': BROWSER_UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
      });
      await openImage(file.uri);
    } catch {
      setMessage('Não foi possível baixar a imagem desse link.');
    } finally {
      setBusy(false);
    }
  }

  async function fromGallery() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled && r.assets[0]) await openImage(r.assets[0].uri);
  }

  async function fromClipboard() {
    setBusy(true);
    try {
      if (await Clipboard.hasImageAsync()) {
        const img = await Clipboard.getImageAsync({ format: 'png' });
        if (img) {
          const file = new File(Paths.cache, `thumb-clip-${Date.now()}.png`);
          file.write(base64ToBytes(img.data.replace(/^data:image\/\w+;base64,/, '')));
          await openImage(file.uri);
          return;
        }
      }
      const text = (await Clipboard.getStringAsync()).trim();
      if (/^https?:\/\//.test(text)) {
        setLink(text);
        await fromLink(text);
        return;
      }
      setMessage('A área de transferência não tem uma imagem nem um link.');
    } catch {
      setMessage('Não foi possível ler a área de transferência.');
    } finally {
      setBusy(false);
    }
  }

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => setStart({ x: pos.x, y: pos.y, zoom }))
    .onUpdate((e) => setOffset(clampAt({ x: start.x + e.translationX, y: start.y + e.translationY }, zoom)));
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => setStart({ x: pos.x, y: pos.y, zoom }))
    .onUpdate((e) => setZoom(Math.min(MAX_ZOOM, Math.max(1, start.zoom * e.scale))));

  async function save() {
    if (!image) return;
    setBusy(true);
    setMessage(null);
    try {
      // The frame, mapped back to source pixels (kept inside the image).
      const cw = Math.min(image.w, Math.round(frameW / scale));
      const ch = Math.min(image.h, Math.round(frameH / scale));
      const ox = Math.max(0, Math.min(image.w - cw, Math.round(-left / scale)));
      const oy = Math.max(0, Math.min(image.h - ch, Math.round(-top / scale)));
      const out = await manipulateAsync(
        image.uri,
        [{ crop: { originX: ox, originY: oy, width: cw, height: ch } }, { resize: { width: OUT_W, height: OUT_H } }],
        { compress: 0.9, format: SaveFormat.JPEG },
      );
      const r = await uploadThumb(db, title, out.uri);
      if (!r.ok) {
        setMessage(r.error);
        return;
      }
      onSaved();
    } catch {
      setMessage('Não foi possível recortar a imagem.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.linkRow}>
        <TextInput
          value={link}
          onChangeText={setLink}
          placeholder="Link da imagem (https://...)"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[common.input, styles.linkInput]}
          onSubmitEditing={() => void fromLink(link)}
        />
        <Button small variant="outline" label="Carregar" disabled={busy || !link.trim()} onPress={() => void fromLink(link)} />
      </View>
      <View style={styles.sources}>
        <Button small variant="outline" icon="image" label="Galeria" disabled={busy} onPress={() => void fromGallery()} />
        <Button small variant="outline" icon="clipboard" label="Colar" disabled={busy} onPress={() => void fromClipboard()} />
      </View>

      <View style={styles.center}>
        <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
          <View style={[styles.frame, { width: frameW, height: frameH }]}>
            {image ? (
              <Image
                source={{ uri: image.uri }}
                style={{ position: 'absolute', width: iw, height: ih, left, top }}
                cachePolicy="none"
              />
            ) : (
              <View style={styles.placeholder}>
                {busy ? (
                  <ActivityIndicator color={colors.mutedForeground} />
                ) : (
                  <Text style={styles.hint}>Escolha uma imagem para recortar no formato da capa (2:3).</Text>
                )}
              </View>
            )}
          </View>
        </GestureDetector>
        {image ? (
          <View style={styles.zoomRow}>
            <IconButton bordered icon="zoom-out" label="Diminuir zoom" onPress={() => setZoom((z) => Math.max(1, z / 1.2))} />
            <Text style={styles.hint}>Arraste e use dois dedos para ajustar</Text>
            <IconButton bordered icon="zoom-in" label="Aumentar zoom" onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2))} />
          </View>
        ) : null}
      </View>

      {message ? <Text style={styles.error}>{message}</Text> : null}

      <View style={styles.actions}>
        <Button variant="ghost" label="Cancelar" disabled={busy} onPress={onCancel} />
        <Button label={busy ? 'Salvando...' : 'Salvar capa'} disabled={!image || busy} onPress={() => void save()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkInput: { flex: 1 },
  sources: { flexDirection: 'row', gap: 8 },
  center: { alignItems: 'center', gap: 10 },
  frame: {
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  hint: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center', flexShrink: 1 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  error: { fontSize: 13, color: colors.destructive },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
