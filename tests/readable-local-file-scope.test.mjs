import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  LocalFileAccessError,
  resolveReadableLocalFile,
} from "../lib/readable-local-file.ts";

function isDenied(error) {
  return error instanceof LocalFileAccessError && error.statusCode === 403;
}

test("a missing user id cannot read the app-data tree", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gslide-read-"));
  const previousApp = process.env.APP_DATA_DIRECTORY;
  const previousTemp = process.env.TEMP_DIRECTORY;
  const temp = path.join(root, "tmp");
  process.env.APP_DATA_DIRECTORY = root;
  process.env.TEMP_DIRECTORY = temp;

  try {
    const secret = path.join(root, "secret.txt");
    const userFile = path.join(root, "images", "users", "user-1", "note.txt");
    const otherFile = path.join(root, "images", "users", "user-2", "note.txt");
    const font = path.join(root, "fonts", "a.ttf");
    fs.mkdirSync(temp, { recursive: true });
    fs.writeFileSync(secret, "nope");
    fs.mkdirSync(path.dirname(userFile), { recursive: true });
    fs.writeFileSync(userFile, "ok");
    fs.mkdirSync(path.dirname(otherFile), { recursive: true });
    fs.writeFileSync(otherFile, "other");
    fs.mkdirSync(path.dirname(font), { recursive: true });
    fs.writeFileSync(font, "font");

    const scope = { userId: "user-1", isAdmin: false };
    assert.equal(resolveReadableLocalFile(userFile, scope), fs.realpathSync(userFile));
    assert.equal(resolveReadableLocalFile(font, scope), fs.realpathSync(font));
    assert.throws(() => resolveReadableLocalFile(otherFile, scope), isDenied);
    assert.throws(() => resolveReadableLocalFile(secret, scope), isDenied);
    assert.throws(
      () => resolveReadableLocalFile(secret, { userId: null, isAdmin: false }),
      isDenied,
    );
    assert.throws(
      () => resolveReadableLocalFile(userFile, { userId: "   ", isAdmin: true }),
      isDenied,
    );
    assert.throws(() => resolveReadableLocalFile(userFile), isDenied);
  } finally {
    if (previousApp === undefined) delete process.env.APP_DATA_DIRECTORY;
    else process.env.APP_DATA_DIRECTORY = previousApp;
    if (previousTemp === undefined) delete process.env.TEMP_DIRECTORY;
    else process.env.TEMP_DIRECTORY = previousTemp;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
