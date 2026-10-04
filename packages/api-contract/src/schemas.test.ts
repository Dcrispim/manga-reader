import { describe, it, expect } from 'vitest';
import {
  ListResponseSchema,
  ReadTitleResponseSchema,
  ReadChapterResponseSchema,
  MetadataResponseSchema,
  BindDataSchema,
  ErrorResponseSchema,
  CategoriesResponseSchema,
} from './schemas';

describe('API Response Schemas', () => {
  describe('ListResponse', () => {
    it('validates a list response', () => {
      const data = [
        {
          caps: 5,
          description: 'Description for Alpha',
          link: '/read/alpha',
          name: 'Alpha',
          thumb: '/api/read/Alpha/01/thumb',
        },
        {
          caps: 2,
          description: 'Description for Beta',
          link: '/read/beta',
          name: 'Beta',
          thumb: '/api/read/Beta/01/thumb',
        },
      ];
      const result = ListResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it('rejects invalid list response', () => {
      const data = [
        {
          caps: 'five', // should be number
          description: 'Description',
          link: '/read/alpha',
          name: 'Alpha',
          thumb: '/api/read/Alpha/01/thumb',
        },
      ];
      const result = ListResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('passes through extra fields', () => {
      const data = [
        {
          caps: 5,
          description: 'Description',
          link: '/read/alpha',
          name: 'Alpha',
          thumb: '/api/read/Alpha/01/thumb',
          extraField: 'should pass through',
        },
      ];
      const result = ListResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('ReadTitleResponse', () => {
    it('validates a read title response', () => {
      const data = {
        chapters: ['1', '2', '0566'],
        modified: {
          '0566': 1696000000000,
          '1': 1696000000000,
          '2': 1696000000000,
        },
      };
      const result = ReadTitleResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects if chapters is not an array', () => {
      const data = {
        chapters: '1,2,3', // should be array
        modified: {
          '1': 1696000000000,
        },
      };
      const result = ReadTitleResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('rejects if modified values are not numbers', () => {
      const data = {
        chapters: ['1', '2'],
        modified: {
          '1': 'timestamp', // should be number
        },
      };
      const result = ReadTitleResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('ReadChapterResponse', () => {
    it('validates a read chapter response', () => {
      const data = {
        images: [
          '/api/read/Alpha/1/0',
          '/api/read/Alpha/1/1',
          '/api/read/Alpha/1/2',
        ],
      };
      const result = ReadChapterResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects if images is a number', () => {
      const data = {
        images: 3, // should be array
      };
      const result = ReadChapterResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('MetadataResponse', () => {
    it('validates metadata with crop thumb', () => {
      const data = {
        author: '',
        categories: [],
        demographic: '',
        description: '',
        published: '',
        status: '',
        thumbSource: 'crop',
        type: '',
        volumes: '',
      };
      const result = MetadataResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('validates metadata with curated thumb', () => {
      const data = {
        author: 'Fulano',
        categories: ['action', 'Comedy'],
        demographic: '',
        description: 'a=b',
        published: '',
        status: '',
        thumbSource: 'curated',
        type: '',
        volumes: '',
      };
      const result = MetadataResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects invalid thumbSource', () => {
      const data = {
        author: '',
        categories: [],
        demographic: '',
        description: '',
        published: '',
        status: '',
        thumbSource: 'invalid', // should be 'crop' or 'curated'
        type: '',
        volumes: '',
      };
      const result = MetadataResponseSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('BindDataSchema', () => {
    it('validates a bind data object', () => {
      const data = {
        chapters: {
          Alpha: '1',
        },
        code: 'ABC123',
        createdAt: 1700000000000,
        history: {},
        updatedAt: 1700000000000,
      };
      const result = BindDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('validates bind data with history', () => {
      const data = {
        chapters: {
          Alpha: '2',
        },
        code: 'ABC123',
        createdAt: 1700000000000,
        history: {
          Alpha: {
            history: ['1', '2'],
            lastRead: 5000,
            openedAt: {
              '1': 4000,
              '2': 5000,
            },
          },
        },
        updatedAt: 1700000001000,
      };
      const result = BindDataSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects if code is missing', () => {
      const data = {
        chapters: { Alpha: '1' },
        createdAt: 1700000000000,
        history: {},
        updatedAt: 1700000000000,
      };
      const result = BindDataSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('ErrorResponse', () => {
    it('validates an error response', () => {
      const data = {
        error: 'Capítulo não encontrado',
      };
      const result = ErrorResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('passes through extra fields', () => {
      const data = {
        error: 'Something went wrong',
        details: 'Extra info',
      };
      const result = ErrorResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('CategoriesResponse', () => {
    it('validates a categories response', () => {
      const data = {
        categories: [
          {
            count: 2,
            id: 'todos',
            name: 'Todos',
          },
          {
            count: 1,
            id: 'ação',
            name: 'Ação',
          },
        ],
      };
      const result = CategoriesResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
