import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
function walk(dir) { for (const name of readdirSync(dir)) { const p = join(dir,name); if (statSync(p).isDirectory()) walk(p); else files.push(p); } }
for (const directory of ["dist/client", "dist/server"]) if (existsSync(directory)) walk(directory);
const patterns = [/hack_[a-f0-9]{30,}/i, /gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{40,}/, /sk-[A-Za-z0-9_-]{30,}/];
let failed = false;
for (const file of files) { if (!existsSync(file) || statSync(file).size > 5_000_000) continue; const content = readFileSync(file,"utf8"); if (patterns.some(p => p.test(content))) { console.error(`Potential credential detected in ${file}. Value withheld.`); failed = true; } }
if (failed) process.exit(1);
console.log(`Secret check passed for ${files.length} source and public build files.`);
