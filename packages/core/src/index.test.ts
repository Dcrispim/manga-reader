import { describe, it, expect } from 'vitest';
import { CORE_VERSION } from './index';

describe('core', () => {
  it('should export CORE_VERSION', () => {
    expect(CORE_VERSION).toBe(1);
  });
});
