import type { Locale } from "./config";

/**
 * Named interpolation parameters passed to a message. Values are coerced to
 * strings when interpolated, so numbers (slide counts, totals) are accepted
 * directly.
 */
export type Params = Record<string, string | number>;

/**
 * A count-aware message function. It receives the interpolation params and the
 * active locale so it can branch on `Intl.PluralRules` for pluralization:
 *
 * ```ts
 * count: (p, locale) => {
 *   const cat = new Intl.PluralRules(locale).select(Number(p.count));
 *   const labels = { one: "1 slide", other: `${p.count} slides` };
 *   return labels[cat as "one" | "other"];
 * }
 * ```
 *
 * The locale is passed in (rather than closed over) so the same catalog works
 * under any active locale without redefining functions.
 */
export type MessageFn = (params: Params, locale: Locale) => string;

/**
 * A leaf message: either a static template string containing `{param}`
 * placeholders, or a count-aware {@link MessageFn}.
 */
export type MessageValue = string | MessageFn;

/**
 * A catalog is a tree of namespaces whose leaves are {@link MessageValue}.
 * Keys are semantic and grouped by feature, independent of the original
 * English sentence (e.g. `outline.actions.continue`).
 */
export type Catalog = {
  [key: string]: MessageValue | Catalog;
};

/** True when a catalog node is a renderable leaf rather than a namespace. */
export function isMessageValue(node: unknown): node is MessageValue {
  return typeof node === "string" || typeof node === "function";
}

/**
 * Union of every dot-path key that resolves to a leaf message in `C`.
 *
 * Used to type-check `t()` keys so typos are caught at compile time. Apply to
 * a concrete catalog literal type (e.g. `MessageKey<typeof vi>`) — the
 * `satisfies Catalog` assertion preserves the narrow literal shape needed for
 * the recursion to see string leaves vs. namespace objects.
 */
export type MessageKey<C, Prefix extends string = ""> = C extends string |
  MessageFn
  ? Prefix extends "" ? never
  : Prefix
  : C extends Record<string, unknown>
    ? {
        [K in keyof C & string]: MessageKey<
          C[K],
          Prefix extends "" ? K : `${Prefix}.${K}`
        >;
      }[keyof C & string]
    : never;