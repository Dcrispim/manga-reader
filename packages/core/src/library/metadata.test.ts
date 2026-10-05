import { describe, it, expect } from 'vitest';
import {
  parseMetadataFile,
  EMPTY_METADATA,
  parseMetadataEntries,
  serializeMetadataEntries,
  isValidMetadataKey,
} from './metadata';

describe('parseMetadataFile', () => {
  it('parses keys, aliases, comments and values containing "="', () => {
    const r = parseMetadataFile(
      '# c\ncategories=a, b,,c\nauthors=X\nsinopse=a=b=c\nvolumes=1,23\nstatus=ok\n'
    );
    expect(r.categories).toEqual(['a', 'b', 'c']);
    expect(r.author).toBe('X');
    expect(r.description).toBe('a=b=c');
    expect(r.volumes).toBe('1,23');
    expect(r.status).toBe('ok');
  });

  it('returns empty defaults without sharing state', () => {
    expect(parseMetadataFile('')).toEqual(EMPTY_METADATA);
  });
});

describe('metadata entries (editor)', () => {
  const file = [
    'categories=Ação,Horror',
    'author=Sakurai',
    'chapters=84',
    '# a comment',
    'categories=action, horror',
    'authors=sakurai, gamon',
    'serialization=good! afternoon',
    'url=https://x.test/?a=b',
  ].join('\n')

  it('keeps first-seen order, last value wins, aliases folded, unknown keys kept', () => {
    expect(parseMetadataEntries(file)).toEqual([
      ['categories', 'action, horror'],
      ['author', 'sakurai, gamon'],
      ['chapters', '84'],
      ['serialization', 'good! afternoon'],
      ['url', 'https://x.test/?a=b'],
    ])
  })

  it('agrees with parseMetadataFile on the known fields', () => {
    const round = parseMetadataFile(serializeMetadataEntries(parseMetadataEntries(file)))
    expect(round).toEqual(parseMetadataFile(file))
  })

  it('serializes single-line values and drops empty values and bad keys', () => {
    const text = serializeMetadataEntries([
      ['description', 'line one\nline two  \r\n three'],
      ['sinopse', 'replaces description'],
      ['tags', ''],
      ['bad key', 'x'],
      ['custom_key-1', ' ok '],
    ])
    expect(text).toBe('description=replaces description\ncustom_key-1=ok\n')
    expect(serializeMetadataEntries([])).toBe('')
  })

  it('validates custom keys', () => {
    expect(isValidMetadataKey('theme')).toBe(true)
    expect(isValidMetadataKey('a=b')).toBe(false)
    expect(isValidMetadataKey('')).toBe(false)
  })
})
