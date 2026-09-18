import path from "node:path";

/**
 * Remote source for the icon SVGs the slide editor recolors through
 * /api/update-svg (split web/api deployments).
 *
 * The bundled single-app build keeps its icon directory next to the Next.js
 * server, but once the web and API containers are split the web container no
 * longer shares `servers/fastapi/static/icons`. The route therefore falls back
 * to fetching each icon from FastAPI — the same origin that already serves
 * `/static/icons/...` to the browser — instead of rendering empty gray icon
 * boxes on the slide canvas.
 *
 * The module stays dependency-free so the fallback is unit-testable under
 * `node --test`; the route passes the resolved FastAPI base URL in.
 */

export const STATIC_ICONS_URL_PREFIX = "/static/icons/";
export const MAX_SVG_SIZE_BYTES = 5 * 1024 * 1024;

export class StaticIconSourceError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "StaticIconSourceError";
        this.status = status;
    }
}

/** Validated `/static/icons/...svg` pathname for one source URL, or null. */
export function parseStaticIconPathname(
    sourceUrl: string,
    requestUrl: string
): string | null {
    let pathname: string;
    try {
        pathname = decodeURIComponent(new URL(sourceUrl, requestUrl).pathname);
    } catch {
        return null;
    }
    if (!pathname.startsWith(STATIC_ICONS_URL_PREFIX)) {
        return null;
    }
    const relativePath = pathname.slice(STATIC_ICONS_URL_PREFIX.length);
    if (
        !relativePath ||
        relativePath.includes("\0") ||
        path.extname(relativePath).toLowerCase() !== ".svg"
    ) {
        return null;
    }
    return pathname;
}

/**
 * Fetch one icon SVG from FastAPI and validate its body.
 *
 * Only pathnames under `/static/icons/` are ever requested, so the fetch
 * cannot be steered at arbitrary origins or paths. Throws
 * `StaticIconSourceError` with the HTTP status the route should surface.
 */
export async function fetchStaticIconSvgFromApi(
    sourceUrl: string,
    requestUrl: string,
    options: {
        fetchImpl: typeof fetch;
        baseUrl: string;
    }
): Promise<string> {
    const pathname = parseStaticIconPathname(sourceUrl, requestUrl);
    if (!pathname) {
        throw new StaticIconSourceError(
            "Only /static/icons SVG sources are supported",
            400
        );
    }

    const baseUrl = options.baseUrl.replace(/\/+$/, "");
    let response: Response;
    try {
        response = await (options.fetchImpl ?? fetch)(`${baseUrl}${pathname}`);
    } catch {
        throw new StaticIconSourceError("Icon SVG source is unreachable", 502);
    }
    if (!response.ok) {
        throw new StaticIconSourceError("Icon SVG source is unavailable", 502);
    }

    const svg = await response.text();
    if (svg.length > MAX_SVG_SIZE_BYTES) {
        throw new StaticIconSourceError("SVG file is too large", 413);
    }
    if (!/<svg\b/i.test(svg)) {
        throw new StaticIconSourceError("Invalid SVG markup", 400);
    }
    return svg;
}