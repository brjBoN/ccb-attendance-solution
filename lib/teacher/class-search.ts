export type SearchableTeacherClass = {
  name: string;
};

export function normalizeClassSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function filterTeacherClasses<T extends SearchableTeacherClass>(
  classes: T[],
  query: string
) {
  const normalizedQuery = normalizeClassSearch(query);
  if (!normalizedQuery) return classes;

  return classes
    .flatMap((item) => {
      const normalizedName = normalizeClassSearch(item.name);
      const matchIndex = normalizedName.indexOf(normalizedQuery);
      return matchIndex === -1 ? [] : [{ item, matchIndex }];
    })
    .sort((left, right) => left.matchIndex - right.matchIndex)
    .map(({ item }) => item);
}
