#!/usr/bin/env node
// PostToolUse hook: runs Prettier (+ ESLint for JS/TS) on the file just
// written/edited by the Write/Edit tools.
import { spawnSync } from "node:child_process";
import { extname } from "node:path";

const PRETTIER_EXTS = new Set([".tsx", ".ts", ".jsx", ".js", ".md"]);
const ESLINT_EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const filePath = payload?.tool_input?.file_path;
  if (!filePath) process.exit(0);

  const ext = extname(filePath);
  if (!PRETTIER_EXTS.has(ext)) process.exit(0);

  const problems = [];

  const prettier = spawnSync("npx", ["prettier", "--write", filePath], {
    encoding: "utf8",
  });
  if (prettier.status !== 0) {
    problems.push(
      `prettier failed on ${filePath}:\n${prettier.stderr || prettier.stdout}`,
    );
  }

  if (ESLINT_EXTS.has(ext)) {
    const eslint = spawnSync(
      "npx",
      ["eslint", "--fix", "--no-warn-ignored", filePath],
      { encoding: "utf8" },
    );
    if (eslint.status !== 0) {
      problems.push(
        `eslint found unresolved issues in ${filePath}:\n${eslint.stdout || eslint.stderr}`,
      );
    }
  }

  if (problems.length > 0) {
    process.stderr.write(problems.join("\n\n"));
    process.exit(2);
  }

  process.exit(0);
});
