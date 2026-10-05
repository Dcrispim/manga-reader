// Volume tabs of the title page, ported from the web (apps/server/src/app/read/
// [title]/page.tsx) so both group chapters the same way. The metadata
// `volumes` field has two shapes: a bare count ("17") splits the chapter-number
// range into that many equal parts; a comma list ("1,23,40") gives the chapter
// where each volume starts. Without it, blocks of 100 chapters.

export type Volume = { label: string; chapters: string[] };

export function computeVolumes(chapters: string[], volumesField: string): Volume[] {
  if (!chapters.length) return [];
  if (!volumesField) {
    const blocks: Volume[] = [];
    for (let i = 0; i < chapters.length; i += 100) {
      blocks.push({ label: `Bloco ${blocks.length + 1}`, chapters: chapters.slice(i, i + 100) });
    }
    return blocks;
  }
  const nums = chapters.map((c) => parseFloat(c));
  if (volumesField.includes(',')) {
    const points = volumesField
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    if (!points.length) return computeVolumes(chapters, '');
    const volumes = points
      .map((start, i) => {
        const end = i + 1 < points.length ? points[i + 1] : Infinity;
        return {
          label: `Volume ${i + 1}`,
          chapters: chapters.filter((_, idx) => nums[idx] >= start && nums[idx] < end),
        };
      })
      .filter((v) => v.chapters.length);
    return volumes.length ? volumes : computeVolumes(chapters, '');
  }
  const count = parseInt(volumesField, 10);
  if (!count || count <= 0) return computeVolumes(chapters, '');
  const maxNum = Math.max(...nums);
  const per = maxNum / count;
  const volumes: Volume[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * per;
    const end = i === count - 1 ? Infinity : (i + 1) * per;
    const vol = chapters.filter((_, idx) => nums[idx] >= start && nums[idx] < end);
    if (vol.length) volumes.push({ label: `Volume ${i + 1}`, chapters: vol });
  }
  return volumes.length ? volumes : computeVolumes(chapters, '');
}

/** "min–max" of a volume, for the tab caption. */
export function volumeRange(v: Volume): string {
  const nums = v.chapters.map((c) => parseFloat(c));
  return `${Math.min(...nums)}–${Math.max(...nums)}`;
}

/** The web's note on how the tabs were computed. */
export function volumeNote(volumesField: string): string {
  if (!volumesField) return 'Sem campo volumes no metadata — paginado a cada 100 capítulos.';
  return volumesField.includes(',')
    ? `Calculado a partir de volumes=${volumesField} (pontos de corte).`
    : `Calculado a partir de volumes=${volumesField} (divisão em partes iguais).`;
}
