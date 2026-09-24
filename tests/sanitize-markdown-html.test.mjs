import assert from "node:assert/strict";
import test from "node:test";
import { marked } from "marked";

import { sanitizeMarkdownHtml } from "../lib/sanitize-markdown-html.ts";

test("ordinary markdown keeps emphasis, lists, and https links", async () => {
  const html = sanitizeMarkdownHtml(
    String(await marked.parse("**Hi**\n\n- one\n\n[docs](https://example.com/a?x=1&y=2)")),
  );

  assert.match(html, /<strong>Hi<\/strong>/);
  assert.match(html, /<li>one<\/li>/);
  assert.match(html, /href="https:\/\/example\.com\/a\?x=1&amp;y=2"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("scripts, event handlers, and script URLs are removed", async () => {
  const html = sanitizeMarkdownHtml(
    [
      '<p onclick="alert(1)">ok</p>',
      "<script>alert(1)</script>",
      '<img src="https://cdn.example/a.png" alt="chart" onerror="alert(1)">',
      '<a href="javascript:alert(1)">x</a>',
      '<a href="java&#115;cript:alert(1)">y</a>',
      '<a href="data:text/html,hi">z</a>',
      '<iframe src="https://evil.example"></iframe>',
    ].join(""),
  );

  assert.match(html, /<p>ok<\/p>/);
  assert.match(html, /src="https:\/\/cdn\.example\/a\.png"/);
  assert.match(html, /alt="chart"/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /onerror|onclick/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /data:text\/html/i);
  assert.doesNotMatch(html, /<iframe/i);
  assert.doesNotMatch(html, /alert\(1\)/);
});

test("raw html in markdown does not survive as an executable tag", async () => {
  const html = sanitizeMarkdownHtml(
    String(await marked.parse('<script>alert(1)</script>\n\n**kept**')),
  );

  assert.match(html, /<strong>kept<\/strong>/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /alert\(1\)/);
});
