export function sortByOrder<T extends { order?: number | null }>(items: T[]): T[] {
  return [...items].sort((first, second) => (first.order ?? 0) - (second.order ?? 0));
}