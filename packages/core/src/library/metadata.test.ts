import { describe, it, expect } from 'vitest';
import { parseMetadataFile, EMPTY_METADATA } from './metadata';

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
