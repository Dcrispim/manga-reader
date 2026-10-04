import { describe, it, expect } from 'vitest';
import { CORE_VERSION } from '@manga/core';

describe('core import', () => {
  it('should import CORE_VERSION from @manga/core', () => {
    expect(CORE_VERSION).toBe(1);
  });
});
