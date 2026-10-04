import { describe, it, expect } from 'vitest';
import { paths, resolveUrl } from './paths';

describe('API Path Constructors', () => {
  describe('Basic paths', () => {
    it('generates /api/list', () => {
      expect(paths.list()).toBe('/api/list');
    });

    it('generates /api/health', () => {
      expect(paths.health()).toBe('/api/health');
    });
  });

  describe('Catalog path', () => {
    it('generates /api/catalog without since', () => {
      expect(paths.catalog()).toBe('/api/catalog');
    });

    it('generates /api/catalog?since=X with since', () => {
      expect(paths.catalog(1696000000000)).toBe('/api/catalog?since=1696000000000');
    });
  });

  describe('Read paths', () => {
    it('encodes title in readTitle', () => {
      expect(paths.readTitle('Test/Title')).toBe('/api/read/Test%2FTitle');
    });

    it('encodes both title and chapter in readChapter', () => {
      expect(paths.readChapter('Test/Title', '1.5')).toBe(
        '/api/read/Test%2FTitle/1.5'
      );
    });

    it('constructs readImage with index', () => {
      expect(paths.readImage('Alpha', '1', 0)).toBe('/api/read/Alpha/1/0');
    });

    it('encodes title in readThumb', () => {
      expect(paths.readThumb('Test/Title', '1')).toBe('/api/read/Test%2FTitle/1/thumb');
    });

    it('constructs readChapterXl', () => {
      expect(paths.readChapterXl('Alpha', '2')).toBe('/api/read/Alpha/2/xl');
    });
  });

  describe('Upscale paths', () => {
    it('constructs upscaleStatus', () => {
      expect(paths.upscaleStatus('Alpha', '1')).toBe('/api/read/Alpha/1/upscale');
    });

    it('upscaleStart is same as upscaleStatus', () => {
      expect(paths.upscaleStart('Beta', '2')).toBe('/api/read/Beta/2/upscale');
    });
  });

  describe('Metadata path', () => {
    it('encodes title in metadata', () => {
      expect(paths.metadata('Test/Title')).toBe('/api/metadata/Test%2FTitle');
    });
  });

  describe('Categories paths', () => {
    it('generates /api/categories', () => {
      expect(paths.categories()).toBe('/api/categories');
    });

    it('encodes categoryId in category', () => {
      expect(paths.category('test/cat')).toBe('/api/categories/test%2Fcat');
    });
  });

  describe('Bind paths', () => {
    it('generates /api/bind for create', () => {
      expect(paths.bindCreate()).toBe('/api/bind');
    });

    it('encodes code in bindGet', () => {
      expect(paths.bindGet('ABC-123')).toBe('/api/bind/ABC-123');
    });

    it('encodes code in bindUpdate', () => {
      expect(paths.bindUpdate('XYZ-999')).toBe('/api/bind/XYZ-999');
    });
  });

  describe('URL resolution', () => {
    it('resolves relative URLs correctly', () => {
      expect(resolveUrl('http://localhost:3993', '/api/read/Alpha/1')).toBe(
        'http://localhost:3993/api/read/Alpha/1'
      );
    });

    it('handles base URLs with trailing slash', () => {
      expect(resolveUrl('http://localhost:3993/', '/api/list')).toBe(
        'http://localhost:3993/api/list'
      );
    });

    it('handles relative paths without leading slash', () => {
      expect(resolveUrl('http://localhost:3993', 'api/list')).toBe(
        'http://localhost:3993/api/list'
      );
    });

    it('handles relative paths with leading slash', () => {
      expect(resolveUrl('http://localhost:3993', '/api/list')).toBe(
        'http://localhost:3993/api/list'
      );
    });

    it('combines base and relative correctly with double slash handling', () => {
      const base = 'http://localhost:3993/';
      const relative = '/api/health';
      expect(resolveUrl(base, relative)).toBe('http://localhost:3993/api/health');
    });
  });

  describe('Special characters encoding', () => {
    it('encodes spaces in title', () => {
      expect(paths.readTitle('My Title')).toBe('/api/read/My%20Title');
    });

    it('encodes special characters in title', () => {
      expect(paths.readTitle('Title: [Part 1]')).toBe(
        '/api/read/Title%3A%20%5BPart%201%5D'
      );
    });

    it('encodes spaces in chapter', () => {
      expect(paths.readChapter('Alpha', 'Chapter 1')).toBe(
        '/api/read/Alpha/Chapter%201'
      );
    });
  });
});
