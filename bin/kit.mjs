#!/usr/bin/env node
// kit: start projects from Soleone's current best practices and track which revision each one is on.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES = join(KIT, "templates");
// KIT_REGISTRY=http://localhost:3001/r/{name}.json tries unpushed registry changes.
const REGISTRY = process.env.KIT_REGISTRY ?? "https://raw.githubusercontent.com/Soleone/shadcn-components/main/public/r/{name}.json";
const SHADCN = ["dlx", "shadcn@latest"];

const USAGE = `kit: start projects from current best practices

  kit new <name> [-t web]   scaffold ./<name> from a template (default: web)
  kit check                 vendored shadcn/@soleone files match upstream; no dead code (knip)
  kit status                list projects under $SRC with their kit revision
  kit upgrade [--mark]      show kit changes since this project's revision; --mark records the latest
  kit adopt [-t web]        start tracking an existing project at revision r0 (before kit)

templates: ${listTemplates().join(", ")}    latest revision: ${latestRevision()}`;

const [command, ...args] = process.argv.slice(2);
const commands = { new: create, check, status, upgrade, adopt };
if (!commands[command]) {
  console.log(USAGE);
  process.exit(command && command !== "help" ? 1 : 0);
}
await commands[command](args);

// --- commands

async function create(args) {
  const name = args.find((arg) => !arg.startsWith("-") && args[args.indexOf(arg) - 1] !== "-t");
  const template = option(args, "-t") ?? "web";
  if (!name) fail("usage: kit new <name> [-t web]");
  if (!listTemplates().includes(template)) fail(`unknown template "${template}"`);
  const dir = resolve(name);
  if (existsSync(dir)) fail(`${dir} already exists`);
  requireCommand("vp", "Vite+ is not on PATH. Install it from https://viteplus.dev or source ~/.config/vite-plus/env.");

  step("Scaffolding React + TypeScript with Vite+");
  run("vp", ["create", "vite", "--no-interactive", "--no-git", "--no-hooks", "--no-editor", "--agent", "agents",
    "--package-manager", "pnpm", "--", name, "--template", "react-ts"], dirname(dir));
  for (const demo of ["src/App.css", "src/assets", "public/icons.svg"]) rmSync(join(dir, demo), { recursive: true, force: true });

  step("Tailwind and the @ alias");
  edit(dir, "tsconfig.json", (text) => {
    const json = JSON.parse(text);
    json.compilerOptions = { ...json.compilerOptions, paths: { "@/*": ["./src/*"] } };
    return `${JSON.stringify(json, null, 2)}\n`;
  });
  edit(dir, "tsconfig.app.json", (text) => replaceOnce(text, '"noEmit": true,', '"noEmit": true,\n    "paths": { "@/*": ["./src/*"] },'));
  // vite.config.ts is bundled before it runs, and it imports the theme plugin from src/.
  edit(dir, "tsconfig.node.json", (text) => replaceOnce(text, '"module": "nodenext",', '"module": "esnext",\n    "moduleResolution": "bundler",'));
  writeFileSync(join(dir, "src/index.css"), '@import "tailwindcss";\n');
  run("vp", ["add", "-D", "tailwindcss", "@tailwindcss/vite", "@shadcn/lint", "knip"], dir);

  step("shadcn (base-nova) and the @soleone theme kit");
  run("pnpm", [...SHADCN, "init", "-b", "base", "-p", "nova", "-y", "--no-monorepo"], dir);
  edit(dir, "components.json", (text) => {
    const json = JSON.parse(text);
    json.registries = { ...json.registries, "@soleone": REGISTRY };
    return `${JSON.stringify(json, null, 2)}\n`;
  });
  run("pnpm", [...SHADCN, "add", "@soleone/theme-picker", "@soleone/theme-vite", "-y"], dir);
  edit(dir, "src/index.css", (text) => {
    const imports = '@import "./components/soleone/theme/theme.css";\n@import "./components/soleone/material/material.css";\n';
    const lastImport = [...text.matchAll(/^@import .*\n/gm)].at(-1);
    if (!lastImport) fail("src/index.css has no @import lines to follow");
    const at = lastImport.index + lastImport[0].length;
    return text.slice(0, at) + imports + text.slice(at);
  });
  edit(
    dir,
    "src/index.css",
    (text) => `${text}\n@layer base {\n  button:not(:disabled),\n  [role="button"]:not(:disabled) {\n    cursor: pointer;\n  }\n}\n`,
  );

  step(`Applying the ${template} template`);
  copyTemplate(join(TEMPLATES, template), dir, name);
  edit(dir, "index.html", (text) => text.replace(/<title>.*<\/title>/, `<title>${name}</title>`));
  writeKitFile(dir, { template, revision: latestRevision(), created: today(), allowDrift: [] });

  step("Formatting and checking");
  run("vp", ["check", "--fix"], dir);
  run("git", ["init", "-q", "-b", "main"], dir);
  run("git", ["add", "-A"], dir);
  run("git", ["commit", "-q", "-m", `chore: scaffold from kit ${template} ${latestRevision()}`], dir);

  console.log(`\nDone: ${relative(process.cwd(), dir) || "."}\n  cd ${name} && vp dev`);
}

async function check() {
  const root = projectRoot();
  const vendoredOk = checkVendored(root);
  const deadCodeOk = checkDeadCode(root);
  if (!vendoredOk || !deadCodeOk) process.exit(1);
}

/** Unused files, exports and dependencies, when the project has knip. */
function checkDeadCode(root) {
  if (!existsSync(join(root, "knip.json"))) return true;
  console.log("\nLooking for unused files, exports and dependencies (knip)...");
  const result = spawnSync("pnpm", ["exec", "knip", "--no-progress"], { cwd: root, stdio: ["ignore", "inherit", "inherit"] });
  if (result.status === 0) console.log("OK: no dead code.");
  return result.status === 0;
}

function checkVendored(root) {
  const kit = readKitFile(root);
  const uiDir = ["src/components/ui", "components/ui"].find((path) => existsSync(join(root, path)));
  const soleoneDir = ["src/components/soleone", "components/soleone"].find((path) => existsSync(join(root, path)));
  const stock = uiDir ? readdirSync(join(root, uiDir)).filter((file) => /\.tsx?$/.test(file)).map((file) => file.replace(/\.tsx?$/, "")) : [];
  const soleone = soleoneDir ? readdirSync(join(root, soleoneDir)).map((item) => `@soleone/${item}`) : [];
  if (stock.length + soleone.length === 0) {
    console.log("No vendored components found.");
    return true;
  }

  // Registry items get one dry run each: listed together with others, shadcn sometimes compares a
  // file without its "use client" line and reports drift that isn't there.
  console.log(`Comparing ${stock.length + soleone.length} items with upstream...`);
  const batches = [...(stock.length ? [stock] : []), ...soleone.map((item) => [item])];
  const output = batches.map((batch) => {
    const result = spawnSync("pnpm", [...SHADCN, "add", ...batch, "--dry-run"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const text = `${result.stdout}${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
    if (result.status !== 0) fail(`shadcn dry run of ${batch.join(" ")} failed:\n${text}`);
    return text;
  }).join("\n");

  const allowed = new Set(kit?.allowDrift ?? []);
  const unique = (paths) => [...new Set(paths)];
  const drifted = unique([...output.matchAll(/~ (\S+)\s+overwrite/g)].map((match) => match[1])).filter((path) => differsFromUpstream(root, path));
  const missing = unique([...output.matchAll(/\+ (\S+\.\w+)\s+create/g)].map((match) => match[1]));
  const failing = drifted.filter((path) => !allowed.has(path));

  for (const path of drifted) console.log(`${allowed.has(path) ? "allowed" : "DRIFT  "} ${path}`);
  for (const path of missing) console.log(`missing ${path}`);
  if (failing.length === 0) {
    console.log(`OK: vendored files match upstream${allowed.size ? ` (${allowed.size} allowed in .kit.json)` : ""}.`);
    return true;
  }

  console.log(`
${failing.length} file(s) differ from upstream. Either upstream moved on (update with
  pnpm dlx shadcn@latest add <item> --overwrite) or the file was edited locally: move the change
into a wrapper or tokens, or list the path under "allowDrift" in .kit.json. See a diff with
  pnpm dlx shadcn@latest add <item> --diff <path>`);
  return false;
}

/**
 * Whether a file the dry run reported really differs. shadcn's dry run sometimes compares a file
 * without its "use client" line, so the file's own diff must show more than that line.
 */
function differsFromUpstream(root, path) {
  const soleone = path.match(/components\/soleone\/([^/]+)\//);
  const item = soleone ? `@soleone/${soleone[1]}` : path.split("/").pop().replace(/\.\w+$/, "");
  const result = spawnSync("pnpm", [...SHADCN, "add", item, "--dry-run", "--diff", path], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const text = `${result.stdout}${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
  if (result.status !== 0) fail(`shadcn diff of ${path} failed:\n${text}`);
  // Diff lines sit inside a nested box: "│ │ -removed", "│ │ +added".
  const changed = text.split("\n").filter((line) => /^│ │ [-+]/.test(line) && !/^│ │ (---|\+\+\+) /.test(line)).map((line) => line.slice(4));
  return changed.some((line) => !/^[-+]\s*("use client"\s*)?$/.test(line));
}

async function status() {
  const src = process.env.SRC ?? join(homedir(), "src");
  const latest = latestRevision();
  const projects = findKitFiles(src, 4);
  if (projects.length === 0) return console.log(`No projects with .kit.json under ${src}.`);
  for (const dir of projects) {
    const { template, revision } = readKitFile(dir);
    const behind = revisionNumber(latest) - revisionNumber(revision);
    console.log(`${relative(src, dir).padEnd(32)} ${template.padEnd(6)} ${revision.padEnd(4)} ${behind > 0 ? `${behind} behind` : "latest"}`);
  }
}

async function upgrade(args) {
  const root = projectRoot();
  const kit = readKitFile(root) ?? fail("No .kit.json here. Use kit adopt first.");
  const latest = latestRevision();
  if (args.includes("--mark")) {
    writeKitFile(root, { ...kit, revision: latest });
    return console.log(`Marked ${relative(process.cwd(), root) || "."} as ${latest}.`);
  }
  const entries = changelog().filter((entry) => revisionNumber(entry.revision) > revisionNumber(kit.revision));
  if (entries.length === 0) return console.log(`Up to date (${kit.revision}).`);
  console.log(`This project is on ${kit.revision}; the kit is on ${latest}. Apply these, oldest first, then run kit upgrade --mark.\n`);
  for (const entry of entries.reverse()) console.log(entry.text);
}

async function adopt(args) {
  const root = resolve(".");
  const template = option(args, "-t") ?? "web";
  if (existsSync(join(root, ".kit.json"))) fail(".kit.json already exists");
  writeKitFile(root, { template, revision: "r0", created: today(), allowDrift: [] });
  console.log(`Tracking ${root} as ${template} r0. Run kit upgrade to see what to bring over.`);
}

// --- revisions

function changelog() {
  const text = readFileSync(join(KIT, "CHANGELOG.md"), "utf8");
  return text.split(/^(?=## r\d+)/m).filter((part) => part.startsWith("## r")).map((part) => ({ revision: part.match(/^## (r\d+)/)[1], text: part.trim() }));
}
function latestRevision() {
  return changelog()[0]?.revision ?? "r0";
}
function revisionNumber(revision) {
  return Number(String(revision).replace(/^r/, "")) || 0;
}

// --- project files

function projectRoot() {
  for (let dir = resolve("."); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir;
    if (dir === dirname(dir)) fail("Not inside a project (no package.json found).");
  }
}
function readKitFile(dir) {
  const path = join(dir, ".kit.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
}
function writeKitFile(dir, kit) {
  writeFileSync(join(dir, ".kit.json"), `${JSON.stringify(kit, null, 2)}\n`);
}
function findKitFiles(dir, depth) {
  if (depth < 0) return [];
  const found = existsSync(join(dir, ".kit.json")) ? [dir] : [];
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    found.push(...findKitFiles(join(dir, entry.name), depth - 1));
  }
  return found;
}

/** Copies a template over the project, filling in __NAME__. AGENTS.kit.md goes above Vite+'s AGENTS.md. */
function copyTemplate(from, to, name) {
  for (const entry of readdirSync(from, { recursive: true })) {
    const source = join(from, entry);
    if (statSync(source).isDirectory()) continue;
    const text = readFileSync(source, "utf8").replaceAll("__NAME__", name);
    if (entry === "AGENTS.kit.md") {
      const agents = join(to, "AGENTS.md");
      writeFileSync(agents, `${text}\n${existsSync(agents) ? readFileSync(agents, "utf8") : ""}`);
      continue;
    }
    cpSync(source, join(to, entry));
    writeFileSync(join(to, entry), text);
  }
}

// --- helpers

function edit(dir, file, change) {
  const path = join(dir, file);
  writeFileSync(path, change(readFileSync(path, "utf8")));
}
function replaceOnce(text, search, replacement) {
  if (!text.includes(search)) fail(`expected to find ${search}; the upstream template changed, update kit`);
  return text.replace(search, replacement);
}
function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: ["ignore", "inherit", "inherit"] });
  if (result.status !== 0) fail(`${cmd} ${args.join(" ")} failed in ${cwd}`);
}
function requireCommand(cmd, message) {
  if (spawnSync(cmd, ["--version"], { stdio: "ignore" }).error) fail(message);
}
function option(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}
function listTemplates() {
  return readdirSync(TEMPLATES);
}
function today() {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time
}
function step(message) {
  console.log(`\n== ${message}`);
}
function fail(message) {
  console.error(`kit: ${message}`);
  process.exit(1);
}
