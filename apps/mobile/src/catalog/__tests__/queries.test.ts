import { chapterSources, downloads, history, jobs, titles, transientPages } from '../../db/schema';
import { createTestDb } from '../../db/testDb';
import {
  badgeLabel,
  buildCatalog,
  categoriesOf,
  chapterRows,
  continueReading,
  downloadedTitles,
  gridColumns,
  q,
} from '../queries';

function seed() {
  const db = createTestDb();
  db.insert(titles)
    .values([
      { name: 'Alpha', categoriesJson: '["action"]', metadataJson: '{"author":"A"}', serverMtime: 50, updatedAt: 1 },
      { name: 'Beta', categoriesJson: '["Ação","Drama"]', serverMtime: 90, updatedAt: 1 },
      { name: 'Gamma', categoriesJson: 'not json', updatedAt: 70 },
    ])
    .run();
  const src = (title: string, n: number, sourceId = 'server', pages: number | null = 10) =>
    db
      .insert(chapterSources)
      .values({ title, chapter: String(n), sourceId, location: 'x', pages, mtimeMs: 1 })
      .run();
  for (let i = 1; i <= 250; i++) src('Alpha', i);
  src('Beta', 1);
  src('Beta', 2);
  return { db, src };
}

describe('catalog and categories', () => {
  it('builds titles with chapter counts and tolerates bad JSON', () => {
    const { db } = seed();
    const cat = buildCatalog(q.titles(db).all(), q.chapterCounts(db).all());
    const by = Object.fromEntries(cat.map((t) => [t.name, t]));
    expect(by.Alpha.caps).toBe(250);
    expect(by.Alpha.meta.author).toBe('A');
    expect(by.Gamma.categories).toEqual([]);
    expect(by.Gamma.caps).toBe(0);
    expect(by.Gamma.modifiedAt).toBe(70); // falls back to updated_at
  });

  it('maps special and normalized categories via core', () => {
    const { db } = seed();
    const map = categoriesOf(buildCatalog(q.titles(db).all(), q.chapterCounts(db).all()));
    expect(map.todos.titles).toHaveLength(3);
    expect(map.recentes.titles[0]).toBe('Beta');
    // "action" and "Ação" normalize to the same category.
    expect(map['ação'].titles.sort()).toEqual(['Alpha', 'Beta']);
    expect(map['mais-de-200'].titles).toEqual(['Alpha']);
    expect(map['menos-de-100'].titles.sort()).toEqual(['Beta', 'Gamma']);
  });
});

describe('continueReading', () => {
  it('orders by last open and uses the latest chapter', () => {
    const rows = [
      { title: 'Alpha', chapter: '3', openedAt: 10 },
      { title: 'Alpha', chapter: '4', openedAt: 20 },
      { title: 'Beta', chapter: '1', openedAt: 30 },
      { title: 'Gone', chapter: '1', openedAt: 40 },
    ];
    const out = continueReading(rows, new Set(['Alpha', 'Beta']));
    expect(out).toEqual([
      { title: 'Beta', chapter: '1', lastRead: 30 },
      { title: 'Alpha', chapter: '4', lastRead: 20 },
    ]);
  });

  it('lists downloaded titles newest first', () => {
    expect(
      downloadedTitles(
        [
          { title: 'A', savedAt: 1 },
          { title: 'B', savedAt: 5 },
          { title: 'A', savedAt: 3 },
          { title: 'X', savedAt: 9 },
        ],
        new Set(['A', 'B']),
      ),
    ).toEqual(['B', 'A']);
  });
});

describe('chapterRows', () => {
  it('derives the state of every chapter from the tables', () => {
    const { db, src } = seed();
    src('Beta', 3);
    src('Beta', 4);
    src('Beta', 5);
    src('Beta', 6);
    src('Beta', 7, 'saf1', null);
    db.insert(downloads)
      .values({ title: 'Beta', chapter: '1', dir: 'd', pages: 10, bytes: 1, savedAt: 1, quality: 'original' })
      .run();
    db.insert(transientPages)
      .values({ title: 'Beta', chapter: '2', page: 1, path: 'p', bytes: 1, lastAccess: 1 })
      .run();
    db.insert(jobs)
      .values([
        { kind: 'download', title: 'Beta', chapter: '3', state: 'running', pagesDone: 4, pagesTotal: 10, createdAt: 1 },
        { kind: 'download', title: 'Beta', chapter: '4', state: 'paused', createdAt: 1 },
        { kind: 'upgrade', title: 'Beta', chapter: '5', state: 'queued', createdAt: 1 },
      ])
      .run();
    db.insert(history).values({ title: 'Beta', chapter: '2', openedAt: 5 }).run();

    const rows = chapterRows({
      sources: q.sources(db, 'Beta').all(),
      downloads: q.titleDownloads(db, 'Beta').all(),
      transient: q.titleTransient(db, 'Beta').all(),
      jobs: q.titleJobs(db, 'Beta').all(),
      history: q.titleHistory(db, 'Beta').all(),
    });
    expect(rows.map((r) => r.chapter)).toEqual(['7', '6', '5', '4', '3', '2', '1']);
    const label = Object.fromEntries(rows.map((r) => [r.chapter, badgeLabel(r.badge)]));
    expect(label).toEqual({
      '7': 'local',
      '6': null,
      '5': null, // upgrade jobs do not count as a download in the queue
      '4': 'aguardando espaço',
      '3': 'na fila (4/10)',
      '2': 'em cache',
      '1': 'baixado',
    });
    expect(rows.find((r) => r.chapter === '2')!.read).toBe(true);
    expect(rows.find((r) => r.chapter === '7')!.onServer).toBe(false);
  });

  it('sorts numerically (not lexically) and can flip the order', () => {
    const base = { downloads: [], transient: [], jobs: [], history: [] };
    const sources = ['2', '10', '1.5'].map((chapter) => ({ chapter, sourceId: 'server', pages: null }));
    expect(chapterRows({ ...base, sources }).map((r) => r.chapter)).toEqual(['10', '2', '1.5']);
    expect(chapterRows({ ...base, sources }, true).map((r) => r.chapter)).toEqual(['1.5', '2', '10']);
  });
});

describe('gridColumns', () => {
  it('is ~3 on a phone and 6 to 8 on a tablet', () => {
    expect(gridColumns(411)).toBe(3);
    expect(gridColumns(800)).toBe(6);
    expect(gridColumns(1040)).toBe(8);
  });
});
