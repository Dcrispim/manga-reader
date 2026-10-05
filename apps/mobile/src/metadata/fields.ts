// Same common fields, order and keys as the web editor
// (apps/server/src/components/metadata/MetadataEditor.tsx).
export const COMMON_FIELDS: { key: string; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'description', label: 'Sinopse', placeholder: 'Resumo da história', multiline: true },
  { key: 'categories', label: 'Tags / categorias', placeholder: 'Ação, Fantasia, Isekai (separe por vírgula)' },
  { key: 'author', label: 'Autor', placeholder: 'Nome do autor' },
  { key: 'status', label: 'Status', placeholder: 'ongoing, finished...' },
  { key: 'type', label: 'Tipo', placeholder: 'manga, manhwa, manhua' },
  { key: 'demographic', label: 'Demografia', placeholder: 'shounen, seinen...' },
  { key: 'published', label: 'Publicação', placeholder: 'jul 6, 2012 to feb 5, 2021' },
  { key: 'volumes', label: 'Volumes', placeholder: '17, ou o 1º capítulo de cada volume: 1,23,40' },
];

export const COMMON_KEYS = new Set(COMMON_FIELDS.map((f) => f.key));

export type CustomRow = { id: number; key: string; value: string };

/** Problem with the custom keys, or null when they can be saved. */
export function customKeysError(rows: CustomRow[]): string | null {
  const keys = rows.map((r) => r.key.trim()).filter(Boolean);
  for (const k of keys) {
    if (COMMON_KEYS.has(k)) return `"${k}" já é um campo comum acima.`;
    if (!/^[A-Za-z0-9_-]+$/.test(k)) return `Chave inválida: "${k}". Use letras, números, "_" ou "-".`;
  }
  return new Set(keys).size === keys.length ? null : 'Há chaves personalizadas repetidas.';
}
