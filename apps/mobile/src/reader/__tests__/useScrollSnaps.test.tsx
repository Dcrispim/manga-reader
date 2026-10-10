import { snapStorageKey } from '@manga/core';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { act, create } from 'react-test-renderer';

import { createTestDb } from '../../db/testDb';
import type { Db } from '../../db/types';
import { getSetting } from '../../settings/repo';
import { useScrollSnaps } from '../useScrollSnaps';

type Input = Parameters<typeof useScrollSnaps>[0];

function mount(props: Input) {
  const out: { current: ReturnType<typeof useScrollSnaps> | null } = { current: null };
  function Probe(p: { input: Input }) {
    out.current = useScrollSnaps(p.input);
    return null;
  }
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<Probe input={props} />); });
  const scroll = (y: number, height = 1000) =>
    out.current!.onScroll({
      nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 100, height } },
    } as NativeSyntheticEvent<NativeScrollEvent>);
  return { scroll, rerender: (i: Input) => act(() => tree.update(<Probe input={i} />)) };
}

const saved = (db: Db, chapter = '1') => getSetting(db, snapStorageKey('T', chapter));

describe('useScrollSnaps', () => {
  it('saves the highest snap crossed while scrolling down', () => {
    const db = createTestDb();
    const { scroll } = mount({ db, title: 'T', chapter: '1' });
    scroll(350);
    expect(saved(db)).toBe('3');
    scroll(720);
    expect(saved(db)).toBe('7');
  });

  it('does not save without crossing a snap', () => {
    const db = createTestDb();
    const { scroll } = mount({ db, title: 'T', chapter: '1' });
    scroll(50);
    scroll(90);
    expect(saved(db)).toBeNull();
  });

  it('does not save while scrolling up', () => {
    const db = createTestDb();
    const { scroll } = mount({ db, title: 'T', chapter: '1' });
    scroll(550);
    scroll(150);
    expect(saved(db)).toBe('5');
  });

  it('restarts from the top when the chapter changes', () => {
    const db = createTestDb();
    const { scroll, rerender } = mount({ db, title: 'T', chapter: '1' });
    scroll(850);
    rerender({ db, title: 'T', chapter: '2' });
    scroll(250);
    expect(saved(db, '2')).toBe('2');
    expect(saved(db, '1')).toBe('8');
  });
});
