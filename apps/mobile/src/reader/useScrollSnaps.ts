import { crossedSnap, snapOffset, snapStorageKey } from '@manga/core';
import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import type { Db } from '../db/types';
import { getSetting, setSetting } from '../settings/repo';

const RESTORE_WINDOW_MS = 4000;

type Scrollable = { scrollToOffset(params: { offset: number; animated?: boolean }): void };

export function useScrollSnaps({ db, title, chapter }: { db: Db; title: string; chapter: string }) {
  const prevY = useRef(0);
  const list = useRef<Scrollable | null>(null);
  const saved = useRef(0);
  const restoring = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    prevY.current = 0;
  }, [title, chapter]);

  const onScrollBeginDrag = useCallback(() => {
    restoring.current = false;
    clearTimeout(timer.current);
  }, []);

  const ref = useCallback(
    (node: Scrollable | null) => {
      onScrollBeginDrag();
      list.current = node;
      if (!node) return;
      saved.current = Number(getSetting(db, snapStorageKey(title, chapter))) || 0;
      if (saved.current <= 0) return;
      restoring.current = true;
      timer.current = setTimeout(onScrollBeginDrag, RESTORE_WINDOW_MS);
    },
    [db, title, chapter, onScrollBeginDrag],
  );

  const onContentSizeChange = (_w: number, h: number) => {
    if (!restoring.current) return;
    const offset = snapOffset(saved.current, h);
    list.current?.scrollToOffset({ offset, animated: false });
    prevY.current = offset;
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize } = e.nativeEvent;
    const y = contentOffset.y;
    if (restoring.current) {
      prevY.current = y;
      return;
    }
    const k = crossedSnap(prevY.current, y, contentSize.height);
    prevY.current = y;
    if (k !== null) setSetting(db, snapStorageKey(title, chapter), String(k));
  };

  return { ref, onScroll, onContentSizeChange, onScrollBeginDrag };
}
