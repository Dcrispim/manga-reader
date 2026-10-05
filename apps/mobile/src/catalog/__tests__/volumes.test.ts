import { computeVolumes, volumeNote, volumeRange } from '../volumes';

const chapters = Array.from({ length: 30 }, (_, i) => String(i + 1));

describe('computeVolumes', () => {
  it('splits the range in equal parts for a bare count', () => {
    const v = computeVolumes(chapters, '3');
    expect(v.map((x) => x.label)).toEqual(['Volume 1', 'Volume 2', 'Volume 3']);
    expect(v.map(volumeRange)).toEqual(['1–9', '10–19', '20–30']);
  });

  it('reads a comma list as the first chapter of each volume', () => {
    const v = computeVolumes(chapters, '1,11,25');
    expect(v.map(volumeRange)).toEqual(['1–10', '11–24', '25–30']);
  });

  it('falls back to blocks of 100 without the field or with garbage', () => {
    const many = Array.from({ length: 250 }, (_, i) => String(i + 1));
    expect(computeVolumes(many, '').map((x) => x.label)).toEqual(['Bloco 1', 'Bloco 2', 'Bloco 3']);
    expect(computeVolumes(chapters, 'abc').map((x) => x.label)).toEqual(['Bloco 1']);
    expect(computeVolumes([], '3')).toEqual([]);
  });

  it('explains how the tabs were computed', () => {
    expect(volumeNote('17')).toContain('divisão em partes iguais');
    expect(volumeNote('1,5')).toContain('pontos de corte');
    expect(volumeNote('')).toContain('100 capítulos');
  });
});
