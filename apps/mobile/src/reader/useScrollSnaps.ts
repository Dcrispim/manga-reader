import { crossedSnap, snapStorageKey } from '@manga/core';
import { useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import type { Db } from '../db/types';
import { setSetting } from '../settings/repo';

export function useScrollSnaps({ db, title, chapter }: { db: Db; title: string; chapter: string }) {
  const prevY = useRef(0);
  useEffect(() => {
    prevY.current = 0;
  }, [title, chapter]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize } = e.nativeEvent;
    const y = contentOffset.y;
    const k = crossedSnap(prevY.current, y, contentSize.height);
    prevY.current = y;
    if (k !== null) setSetting(db, snapStorageKey(title, chapter), String(k));
  };

  return { onScroll };
}
