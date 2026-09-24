const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "form",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

function fromCodePointSafe(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return "";
  return String.fromCodePoint(value);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) =>
      fromCodePointSafe(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);?/g, (_, dec: string) =>
      fromCodePointSafe(Number.parseInt(dec, 10)),
    )
    .replace(/&colon;/gi, ":")
    .replace(/&tab;|&newline;/gi, "")
    .replace(/&amp;/gi, "&");
}

function isSafeUrl(value: string): boolean {
  const decoded = decodeEntities(value).replace(/[\u0000-\u001F\s]+/g, "");
  if (!decoded || /[<>]/.test(decoded)) return false;
  const lower = decoded.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:")
  ) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) {
    return lower.startsWith("https:") || lower.startsWith("http:") || lower.startsWith("mailto:");
  }
  return true;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeAttrs(tag: string, raw: string): string {
  const attrs: string[] = [];
  const attrPattern =
    /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  let hrefKept = false;

  while ((match = attrPattern.exec(raw))) {
    const name = match[1].toLowerCase();
    if (name.startsWith("on") || name === "style" || name === "srcdoc") continue;
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (tag === "a" && name === "href" && isSafeUrl(value)) {
      attrs.push(` href="${escapeAttr(decodeEntities(value))}"`);
      hrefKept = true;
      continue;
    }
    if (tag === "img" && name === "src" && isSafeUrl(value)) {
      attrs.push(` src="${escapeAttr(decodeEntities(value))}"`);
      continue;
    }
    if ((tag === "img" || tag === "a") && (name === "alt" || name === "title")) {
      attrs.push(` ${name}="${escapeAttr(value)}"`);
      continue;
    }
    if (tag === "code" && name === "class" && /^language-[\w-]+$/.test(value)) {
      attrs.push(` class="${value}"`);
      continue;
    }
    if (
      (tag === "td" || tag === "th") &&
      (name === "colspan" || name === "rowspan") &&
      /^\d{1,3}$/.test(value)
    ) {
      attrs.push(` ${name}="${value}"`);
    }
  }

  if (tag === "a" && hrefKept) {
    attrs.push(' rel="noopener noreferrer"');
  }
  return attrs.join("");
}

/**
 * Keep the HTML that ordinary Markdown emits. Drop scripts, event handlers,
 * and URLs that the browser would treat as script.
 */
export function sanitizeMarkdownHtml(html: string): string {
  const source = html.replace(/<!--[\s\S]*?-->/g, "");
  const tagPattern = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(source))) {
    result += source.slice(lastIndex, match.index);
    const full = match[0];
    const name = match[1].toLowerCase();
    const isClosing = full.startsWith("</");

    if (!isClosing && DROP_WITH_CONTENT.has(name)) {
      const close = new RegExp(`</${name}\\b[^>]*>`, "i");
      const rest = source.slice(tagPattern.lastIndex);
      const closeMatch = close.exec(rest);
      tagPattern.lastIndex = closeMatch
        ? tagPattern.lastIndex + closeMatch.index + closeMatch[0].length
        : source.length;
      lastIndex = tagPattern.lastIndex;
      continue;
    }

    if (ALLOWED_TAGS.has(name) && isClosing && !VOID_TAGS.has(name)) {
      result += `</${name}>`;
    } else if (ALLOWED_TAGS.has(name) && !isClosing) {
      const attrSource = full.slice(full.indexOf(name) + name.length, full.endsWith("/>") ? -2 : -1);
      result += `<${name}${sanitizeAttrs(name, attrSource)}>`;
    }

    lastIndex = tagPattern.lastIndex;
  }

  result += source.slice(lastIndex);
  return result;
}
