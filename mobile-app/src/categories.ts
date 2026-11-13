import type { Category } from './api';

// Precisa bater com CATEGORIES em server/src/routes.ts
export const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'anime', label: 'Anime' },
  { key: 'kpop', label: 'K-pop' },
  { key: 'series', label: 'Séries' },
  { key: 'games', label: 'Games' },
  { key: 'music', label: 'Música' },
  { key: 'sports', label: 'Esportes' },
  { key: 'teams', label: 'Times' },
  { key: 'players', label: 'Jogadores' },
];

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.key === c)?.label ?? c;
