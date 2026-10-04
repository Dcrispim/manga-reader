import { describe, it, expect } from 'vitest';
import { isImageFile, compareImageNames, sortImageFiles } from './images';

describe('images', () => {
  it('detects images by mime', () => {
    expect(isImageFile('a.jpg')).toBe(true);
    expect(isImageFile('notes.txt')).toBe(false);
  });

  it('orders numeric names by value, then localeCompare', () => {
    expect(sortImageFiles(['10.jpg', '2.jpg', 'notes.txt', 'b.png', 'a.png', '01.webp'])).toEqual([
      '01.webp',
      '2.jpg',
      '10.jpg',
      'a.png',
      'b.png',
    ]);
    expect(compareImageNames('2.jpg', '10.jpg')).toBeLessThan(0);
  });
});
