#!/usr/bin/env node
// i18n 一致性扫描:
//  1) MISSING      —— 代码引用但语言包缺失 → 退出 1(verify 失败)
//  2) UNREFERENCED —— 语言包存在但代码无引用 → 告警(退出 0)
// 引用判定:getI18nText("key" 直接调用 + 以已知顶层段开头的字符串字面量(兜动态间接引用)。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function flatten(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, path, out);
    else out.push(path);
  }
  return out;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|vue)$/.test(name)) out.push(p);
  }
  return out;
}

const zh = JSON.parse(readFileSync(join(root, "src/i18n/zh_CN.json"), "utf8"));
const en = JSON.parse(readFileSync(join(root, "src/i18n/en_US.json"), "utf8"));
const zhPaths = new Set(flatten(zh));
const enPaths = new Set(flatten(en));
const topSections = new Set(
  Object.keys(zh).filter((k) => zh[k] && typeof zh[k] === "object" && !Array.isArray(zh[k])),
);

const referenced = new Set();
const files = walk(join(root, "src"));
for (const f of files) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(/getI18nText\(\s*"([^"]+)"/g)) referenced.add(m[1]);
  // 疑似键:形如 "<顶层段>.<a.b...>" 的字符串字面量(动态/间接引用兜底,宁多勿漏)
  for (const m of text.matchAll(/"([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)"/g)) {
    if (topSections.has(m[1].split(".")[0])) referenced.add(m[1]);
  }
}

const missing = [...referenced]
  .filter((k) => !zhPaths.has(k) || !enPaths.has(k))
  .sort();
const unreferenced = [...zhPaths].filter((k) => !referenced.has(k)).sort();

if (missing.length) {
  console.log(`MISSING(${missing.length}):引用但语言包缺失`);
  for (const k of missing) {
    const side = zhPaths.has(k) ? "(zh 有 en 缺)" : enPaths.has(k) ? "(en 有 zh 缺)" : "(两包都缺)";
    console.log(`  - ${k} ${side}`);
  }
  process.exit(1);
}

console.log(
  `OK: ${referenced.size} 个引用键 / zh ${zhPaths.size} 键 / en ${enPaths.size} 键`,
);
if (unreferenced.length) {
  console.log(`UNREFERENCED(${unreferenced.length}):语言包存在但无代码引用(告警):`);
  for (const k of unreferenced) console.log(`  - ${k}`);
}
