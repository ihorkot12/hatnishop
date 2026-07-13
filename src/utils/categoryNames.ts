import { useEffect, useState } from 'react';
import { fetchJsonCachedOr } from './apiCache';

// Словник slug → українська назва категорії, завантажується один раз на сесію.
let names: Record<string, string> | null = null;
let pending: Promise<Record<string, string>> | null = null;

const loadNames = () => {
  pending ??= fetchJsonCachedOr<any[]>('/api/categories/catalog', []).then((list) => {
    names = Object.fromEntries((Array.isArray(list) ? list : []).map((c: any) => [c.slug, c.name]));
    return names;
  });
  return pending;
};

// Повертає людську назву категорії за slug (поки словник не завантажився — сам slug).
export const useCategoryLabel = (slug?: string) => {
  const [dict, setDict] = useState(names);
  useEffect(() => {
    if (!names) { loadNames().then(setDict).catch(() => {}); }
  }, []);
  if (!slug) return '';
  return dict?.[slug] || slug;
};
