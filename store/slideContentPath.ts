type PathNode = { [key: string]: unknown };

function asPathNode(value: object): PathNode {
  return value as PathNode;
}

export function contentPathKeys(path: string): string[] {
  return path.split(/[.\[\]]+/).filter(Boolean);
}

function isIndexKey(key: string): boolean {
  return !Number.isNaN(Number(key));
}

function storageKey(key: string): string {
  return isIndexKey(key) ? String(Number(key)) : key;
}

function childAt(current: PathNode, key: string): PathNode {
  const keyName = storageKey(key);
  const existing = current[keyName];
  if (!existing) {
    const created: PathNode = {};
    current[keyName] = created;
    return created;
  }
  if (typeof existing === "object") return existing as PathNode;
  return asPathNode(Object(existing));
}

function writeAt(current: PathNode, key: string, value: unknown): void {
  current[storageKey(key)] = value;
}

function readAt(current: PathNode, key: string): unknown {
  return current[storageKey(key)];
}

/** Walk `content.foo[0].bar` and return the parent plus the last key. */
export function resolveContentParent(
  root: object,
  path: string,
): { parent: PathNode; finalKey: string } | null {
  const keys = contentPathKeys(path);
  if (keys.length === 0) return null;

  let current = asPathNode(root);
  for (let i = 0; i < keys.length - 1; i += 1) {
    current = childAt(current, keys[i]);
  }
  return { parent: current, finalKey: keys[keys.length - 1] };
}

export function setNestedContentValue(
  root: object,
  path: string,
  value: string,
): void {
  const located = resolveContentParent(root, path);
  if (!located) return;
  writeAt(located.parent, located.finalKey, value);
}

export function setNestedMediaValue(
  root: object,
  path: string,
  urlKey: "__image_url__" | "__icon_url__",
  queryKey: "__image_prompt__" | "__icon_query__",
  url: string,
  queryText?: string,
): void {
  const located = resolveContentParent(root, path);
  if (!located) return;
  const target = readAt(located.parent, located.finalKey);
  const previous =
    target && typeof target === "object" ? (target as PathNode) : {};
  const previousQuery = previous[queryKey];
  const updatedValue: PathNode = {
    ...previous,
    [urlKey]: url,
    [queryKey]: queryText || previousQuery || "",
  };
  writeAt(located.parent, located.finalKey, updatedValue);
}

/** First `[n]` in a data path. Missing or invalid indexes stay 0. */
export function firstBracketIndex(dataPath: string): number {
  return parseInt(dataPath.split("[")[1]?.split("]")[0] ?? "") || 0;
}

export function reindexSlides<T extends { index?: number }>(slides: T[]): T[] {
  return slides.map((slide, index) => ({
    ...slide,
    index,
  }));
}
