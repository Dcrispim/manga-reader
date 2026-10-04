import { nextChapter } from '../nextChapter';

describe('nextChapter', () => {
  it('returns the following chapter with no skips', () => {
    expect(nextChapter(['1', '2', '3'], '2')).toEqual({ next: '3', skipped: [] });
  });

  it('reports the whole numbers a jump leaves out', () => {
    expect(nextChapter(['10', '12'], '10')).toEqual({ next: '12', skipped: ['11'] });
    expect(nextChapter(['1', '5'], '1').skipped).toEqual(['2', '3', '4']);
  });

  it('returns null at the last chapter', () => {
    expect(nextChapter(['1', '2'], '2')).toEqual({ next: null, skipped: [] });
  });

  it('treats decimals as real chapters', () => {
    expect(nextChapter(['1', '1.5', '2'], '1')).toEqual({ next: '1.5', skipped: [] });
    expect(nextChapter(['1', '1.5', '2'], '1.5')).toEqual({ next: '2', skipped: [] });
    expect(nextChapter(['1.5', '3'], '1.5')).toEqual({ next: '3', skipped: ['2'] });
  });

  it('orders by numeric value, not by list order or string', () => {
    expect(nextChapter(['10', '9', '2'], '9')).toEqual({ next: '10', skipped: [] });
    expect(nextChapter(['0566', '567'], '566').next).toBe('567');
  });

  it('copes with garbage input', () => {
    expect(nextChapter(['1'], 'x')).toEqual({ next: null, skipped: [] });
  });
});
