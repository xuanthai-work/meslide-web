import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The slide editor recolors every /static/icons SVG through the
// /api/update-svg route before drawing it on the Konva canvas. When the
// web container is split from the API container it no longer shares the
// API's static/icons directory, so the route must fall back to fetching
// the SVG from FastAPI instead of rendering empty gray icon boxes.
import {
    StaticIconSourceError,
    fetchStaticIconSvgFromApi,
} from "../lib/static-icon-fetch.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ICON_URL = "/static/icons/bold/binary-bold.svg";
const SAMPLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" fill="#111827" stroke="#111827"/></svg>';

const ORIGIN = "http://localhost:5001/api/update-svg";

const stubFetch = (handler) => async (input) => handler(String(input));

test("fetches the icon from the FastAPI base URL with a validated pathname", async () => {
  const fetched = [];
  const svg = await fetchStaticIconSvgFromApi(ICON_URL, ORIGIN, {
    baseUrl: "http://api:8000",
    fetchImpl: stubFetch((url) => {
      fetched.push(url);
      return new Response(SAMPLE_SVG, { status: 200 });
    }),
  });

  assert.equal(svg, SAMPLE_SVG);
  assert.deepEqual(fetched, [`http://api:8000${ICON_URL}`]);
});

test("rejects sources outside /static/icons without any fetch", async () => {
  const fetched = [];
  await assert.rejects(
    fetchStaticIconSvgFromApi("https://cdn.example.com/logo.svg", ORIGIN, {
      baseUrl: "http://api:8000",
      fetchImpl: stubFetch((url) => {
        fetched.push(url);
        return new Response(SAMPLE_SVG, { status: 200 });
      }),
    }),
    (error) => error instanceof StaticIconSourceError && error.status === 400
  );
  assert.deepEqual(fetched, []);
});

test("reports an upstream failure as 502", async () => {
  await assert.rejects(
    fetchStaticIconSvgFromApi(ICON_URL, ORIGIN, {
      baseUrl: "http://api:8000",
      fetchImpl: async () => new Response("missing", { status: 404 }),
    }),
    (error) => error instanceof StaticIconSourceError && error.status === 502
  );
  await assert.rejects(
    fetchStaticIconSvgFromApi(ICON_URL, ORIGIN, {
      baseUrl: "http://api:8000",
      fetchImpl: async () => {
        throw new Error("network down");
      },
    }),
    (error) => error instanceof StaticIconSourceError && error.status === 502
  );
});

test("validates the remote body: non-SVG 400, oversized 413", async () => {
  await assert.rejects(
    fetchStaticIconSvgFromApi(ICON_URL, ORIGIN, {
      baseUrl: "http://api:8000",
      fetchImpl: async () => new Response("<html>not an icon</html>", { status: 200 }),
    }),
    (error) => error instanceof StaticIconSourceError && error.status === 400
  );
  await assert.rejects(
    fetchStaticIconSvgFromApi(ICON_URL, ORIGIN, {
      baseUrl: "http://api:8000",
      fetchImpl: async () => new Response(`<svg>${"x".repeat(6 * 1024 * 1024)}</svg>`, { status: 200 }),
    }),
    (error) => error instanceof StaticIconSourceError && error.status === 413
  );
});

test("the update-svg route falls back to the API when the local read fails", async () => {
  const route = await readFile(
    path.join(root, "app/api/update-svg/route.ts"),
    "utf8"
  );

  assert.match(route, /fetchStaticIconSvgFromApi/);
  // The fallback must catch local-read failures (missing shared directory,
  // missing file) and retry against FastAPI before giving up.
  assert.match(route, /catch\s*\{[\s\S]*fetchStaticIconSvgFromApi/);
  assert.match(route, /StaticIconSourceError/);
});