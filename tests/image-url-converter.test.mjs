import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    const findModule = (base) => {
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`]) {
        if (!existsSync(candidate)) continue;
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
          format: candidate.endsWith(".mjs") ? "module" : "module-typescript",
        };
      }
      return null;
    };
    if (specifier.startsWith("@/")) {
      return findModule(path.join(root, specifier.slice(2))) ?? nextResolve(specifier, context);
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return findModule(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)) ?? nextResolve(specifier, context);
    }
    return nextResolve(specifier, context);
  },
});

test("new image subtrees are converted without rescanning existing images", async () => {
  const previous = {
    document: globalThis.document,
    HTMLImageElement: globalThis.HTMLImageElement,
    MutationObserver: globalThis.MutationObserver,
    Node: globalThis.Node,
  };
  let scans = 0;
  let callback;
  class ImageElement {
    nodeType = 1;
    tagName = "IMG";
    writes = 0;
    constructor(src) { this._src = src; }
    get src() { return this._src; }
    set src(value) { this.writes += 1; this._src = value; }
    querySelectorAll() { return []; }
  }
  class GroupElement {
    nodeType = 1;
    tagName = "DIV";
    constructor(images) { this.images = images; }
    querySelectorAll(selector) {
      assert.equal(selector, "img[src]");
      scans += 1;
      return this.images;
    }
  }
  const existing = new ImageElement("https://assets.example/old.png");
  const added = new ImageElement("https://assets.example/new.png");
  const body = new GroupElement([existing]);
  globalThis.document = { body, querySelectorAll: body.querySelectorAll.bind(body) };
  globalThis.HTMLImageElement = ImageElement;
  globalThis.Node = { ELEMENT_NODE: 1 };
  globalThis.MutationObserver = class {
    constructor(onChange) { callback = onChange; }
    observe(target, options) {
      assert.equal(target, body);
      assert.deepEqual(options, { childList: true, subtree: true });
    }
    disconnect() {}
  };

  try {
    const { setupImageUrlConverter } = await import("../utils/image-url-converter.ts");
    setupImageUrlConverter();
    assert.equal(existing.writes, 1);
    assert.equal(scans, 1);

    callback([{ addedNodes: [new GroupElement([added])] }]);
    assert.equal(existing.writes, 1);
    assert.equal(added.writes, 1);
    assert.equal(scans, 2);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
});
