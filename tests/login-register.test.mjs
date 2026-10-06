import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const pagePath = path.join(import.meta.dirname, "..", "app", "login", "page.tsx");

test("login page contains both login and register mode handling", () => {
  const content = readFileSync(pagePath, "utf8");
  assert.match(content, /mode === ["']login["']/);
  assert.match(content, /mode === ["']register["']/);
  assert.match(content, /\/api\/v1\/auth\/register/);
  assert.match(content, /\/api\/v1\/auth\/login/);
  assert.match(content, /confirmPassword/);
});

test("register form validates the password confirmation and minimum length", () => {
  const content = readFileSync(pagePath, "utf8");
  assert.match(content, /password\.length < 6/);
  assert.match(content, /password !== confirmPassword/);
});

test("login and register modes can switch in both directions", () => {
  const content = readFileSync(pagePath, "utf8");
  assert.match(content, /switchMode\(["']register["']\)/);
  assert.match(content, /switchMode\(["']login["']\)/);
});

test("password fields can be obscured and revealed with a visibility toggle", () => {
  const content = readFileSync(pagePath, "utf8");
  assert.match(content, /Eye, EyeOff/);
  assert.match(content, /type=\{visible \? ["']text["'] : ["']password["']\}/);
  assert.match(content, /aria-label=\{visible \? ["']Ẩn mật khẩu["'] : ["']Hiện mật khẩu["']\}/);
  assert.match(content, /showPassword/);
  assert.match(content, /showConfirmPassword/);
});
