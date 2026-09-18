import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_ROOTS = ["app", "components"];
const COPY_ATTRIBUTE = /\b(?:aria-label|aria-description|placeholder|title|alt)=(['"])([^'"{}]+)\1/g;
const JSX_TEXT = /<[A-Za-z][^>\r\n]*>[ \t]*([A-Za-zÀ-ỹ][^<>{}\r\n]*)[ \t]*</g;
const TECHNICAL_ONLY = /^(?:API|CSS|CSV|DOCX|HTML|ID|JSON|LLM|MB|PDF|PPTX|SVG|URL|Web|XLSX|ZIP|Ctrl|Shift|Alt|Enter|Esc|Delete|Backspace|\d[\d .,:/%+-]*)$/i;

// Intentional display exceptions allowed by the localization specification.
// Keep this list exact and short; product sentences do not belong here.
const ALLOWLIST = new Set([
  "app/(presentation-generator)/(dashboard)/settings/TextProvider.tsx|https://host.docker.internal:5000/v1",
  "components/slide-editor/text/TextToolbar.tsx|Aa",
]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (/\.tsx?$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

function normalizeCopy(value) {
  return value.replace(/\s+/g, " ").trim();
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

export async function collectHardcodedCopy(repositoryRoot) {
  const findings = [];
  for (const sourceRoot of SOURCE_ROOTS) {
    for (const absolute of await walk(path.join(repositoryRoot, sourceRoot))) {
      const rawSource = await readFile(absolute, "utf8");
      const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
        comment.replace(/[^\n]/g, " "),
      );
      if (!/(?:\buseT\b|\btranslate\s*\()/.test(source)) continue;
      const relative = path.relative(repositoryRoot, absolute).replaceAll("\\", "/");

      for (const pattern of [COPY_ATTRIBUTE, JSX_TEXT]) {
        pattern.lastIndex = 0;
        for (const match of source.matchAll(pattern)) {
          const copy = normalizeCopy(match[2] ?? match[1]);
          if (!copy || !/[A-Za-zÀ-ỹ]/.test(copy) || TECHNICAL_ONLY.test(copy)) continue;
          if (ALLOWLIST.has(`${relative}|${copy}`)) continue;
          findings.push({ relative, line: lineNumber(source, match.index), copy });
        }
      }
    }
  }
  return findings;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const findings = await collectHardcodedCopy(repositoryRoot);
  if (findings.length) {
    for (const finding of findings) {
      console.error(`${finding.relative}:${finding.line}: ${JSON.stringify(finding.copy)}`);
    }
    process.exitCode = 1;
  } else {
    console.log("No unexplained hard-coded UI copy found.");
  }
}
