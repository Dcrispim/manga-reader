import { initials, placeholderColor } from '../Placeholder';

describe('placeholder', () => {
  it('derives a stable color from the name', () => {
    expect(placeholderColor('Berserk')).toBe(placeholderColor('Berserk'));
    expect(placeholderColor('Berserk')).toMatch(/^hsl\(\d+, 30%, 22%\)$/);
    expect(placeholderColor('Berserk')).not.toBe(placeholderColor('Vagabond'));
  });

  it('builds initials', () => {
    expect(initials('one piece')).toBe('OP');
    expect(initials('Berserk')).toBe('B');
    expect(initials('')).toBe('?');
  });
});
