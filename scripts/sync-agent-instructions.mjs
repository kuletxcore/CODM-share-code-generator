#!/usr/bin/env node
/**
 * Generate every agent-instruction file from AGENTS.md.
 *
 * AGENTS.md is the single source of truth. Different coding agents read different
 * filenames, so the same instructions have to exist in several places. Hand-
 * copying them means they drift, and a stale instruction file is worse than none:
 * the agent confidently follows a rule the project dropped.
 *
 * AGENTS.md is itself written in plain markdown with one machine-readable bit:
 * everything between the `agent-shared` markers is the part that gets mirrored.
 * The `nextjs-agent-rules` block that `next dev` owns is deliberately NOT
 * mirrored — it lives only in AGENTS.md where Next manages it, so that this
 * script never fights Next for that block.
 *
 * Usage:
 *   node scripts/sync-agent-instructions.mjs           # write the mirrors
 *   node scripts/sync-agent-instructions.mjs --check    # exit 1 if any is stale
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "AGENTS.md");
const START = "<!-- BEGIN:agent-shared -->";
const END = "<!-- END:agent-shared -->";

/**
 * Every place an agent or a human might look for these rules.
 *
 * `wrap` is the text that goes above the shared body, so each file explains what
 * it is and why it exists rather than looking like an unexplained duplicate.
 */
const TARGETS = [
  {
    file: "CLAUDE.md",
    wrap: () =>
      "# CLAUDE.md\n\nClaude Code entry point. The content below is generated from\n`AGENTS.md`; edit that file and run `npm run agents:sync`.\n\n",
  },
  {
    file: "GEMINI.md",
    wrap: () =>
      "# GEMINI.md\n\nGemini CLI / Gemini Code Assist entry point. The content below is\ngenerated from `AGENTS.md`; edit that file and run `npm run agents:sync`.\n\n",
  },
  {
    file: ".github/copilot-instructions.md",
    wrap: () =>
      "<!--\n  Generated from AGENTS.md by scripts/sync-agent-instructions.mjs.\n  Edit AGENTS.md and run `npm run agents:sync`, or CI will fail.\n-->\n\n# Copilot instructions\n\n",
  },
  {
    // Cursor, Windsurf, Cline, Roo, Zed, Aider and friends read this name.
    file: ".cursor/rules/agents.mdc",
    wrap: () =>
      "---\ndescription: Repository rules for AI coding agents\nglobs: [\"**/*\"]\nalwaysApply: true\n---\n\n<!--\n  Generated from AGENTS.md by scripts/sync-agent-instructions.mjs.\n  Edit AGENTS.md and run `npm run agents:sync`.\n-->\n\n",
  },
  {
    // Aider and other tools that look for a plain conventions file.
    file: "CONVENTIONS.md",
    wrap: () =>
      "# CONVENTIONS.md\n\nRead by Aider and other tools that do not look for\n`AGENTS.md`. Generated from `AGENTS.md`; edit that file and run\n`npm run agents:sync`.\n\n",
  },
];

/** Pull the shared body out of AGENTS.md. */
function readSharedBody() {
  if (!existsSync(SOURCE)) {
    console.error(`sync-agent-instructions: ${SOURCE} is missing.`);
    process.exit(1);
  }
  const text = readFileSync(SOURCE, "utf-8");
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    console.error(
      `sync-agent-instructions: AGENTS.md has no ${START} … ${END} block to mirror.`,
    );
    process.exit(1);
  }
  return text.slice(start + START.length, end).trim();
}

const body = readSharedBody();
const checkOnly = process.argv.includes("--check");
const drift = [];

for (const target of TARGETS) {
  const out = `${target.wrap()}${body}\n`;
  const path = join(ROOT, target.file);
  const existing = existsSync(path) ? readFileSync(path, "utf-8") : null;

  if (existing === out) continue;

  if (checkOnly) {
    drift.push(target.file);
    continue;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, out, "utf-8");
  console.log(`wrote ${target.file}`);
}

if (checkOnly && drift.length) {
  console.error(
    `Agent instructions are stale. Run \`npm run agents:sync\` and commit:\n  ${drift.join("\n  ")}`,
  );
  process.exit(1);
}

if (!checkOnly) {
  console.log(`synced ${TARGETS.length} agent files from AGENTS.md`);
}
