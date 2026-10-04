import { describe, it, expect } from 'vitest';
import { normalizeCategory, buildCategoryMap } from './categories';

describe('categories', () => {
  it('normalizes aliases and keeps unknown values', () => {
    expect(normalizeCategory(' Action ')).toBe('Ação');
    expect(normalizeCategory('shonen')).toBe('Shounen');
    expect(normalizeCategory('Whatever')).toBe('Whatever');
  });

  it('builds the category map', () => {
    const m = buildCategoryMap([
      { name: 'A', modifiedAt: 1, caps: 10, categories: ['action', 'Slice of Life'] },
      { name: 'B', modifiedAt: 2, caps: 250, categories: ['Ação'] },
    ]);
    expect(m['todos'].titles).toEqual(['A', 'B']);
    expect(m['recentes'].titles).toEqual(['B', 'A']);
    expect(m['acao'] ?? m['ação']).toEqual({ name: 'Ação', titles: ['A', 'B'] });
    expect(m['slice-of-life'].titles).toEqual(['A']);
    expect(m['menos-de-100'].titles).toEqual(['A']);
    expect(m['mais-de-200'].titles).toEqual(['B']);
  });
});
