#!/usr/bin/env node
/**
 * Fails when the test counts printed in the READMEs and the headline figure no longer match the
 * suites they describe.
 *
 * This exists because the numbers went stale twice: rewriting the duration wheel changed the
 * Jest count, and nothing told the documentation. A reviewer who runs `npm test` finds that in
 * thirty seconds, and after it every other number on the page is worth less. A claim that cannot
 * be checked automatically is a claim that will eventually be wrong.
 *
 * The Jest total comes from Jest itself, because `it.each` generates cases that no amount of
 * reading the source can count. The Deno and database suites declare every case literally — a
 * fact this script also checks, so it cannot quietly start undercounting.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function sourceFiles(dir, match) {
  const entries = readdirSync(join(root, dir));
  return entries.flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) {
      return name === 'node_modules' ? [] : sourceFiles(rel, match);
    }
    return match.test(name) ? [rel] : [];
  });
}

function countLiteral(files, pattern, dynamic) {
  let total = 0;
  for (const file of files) {
    const source = read(file);
    const generated = source.match(dynamic);
    if (generated) {
      throw new Error(
        `${file} generates test cases (${generated[0]}), so they can no longer be counted by ` +
          `reading the source. Count that suite from its runner instead.`
      );
    }
    total += (source.match(pattern) ?? []).length;
  }
  return total;
}

function jestTotal() {
  // Jest's own entry point rather than `npx`, which needs a shell on Windows and does not get
  // one here. --silent keeps the suites' output off stdout, so the JSON is alone on it.
  const output = execFileSync(
    process.execPath,
    [join(root, 'node_modules/jest/bin/jest.js'), '--ci', '--silent', '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }
  );
  return JSON.parse(output).numTotalTests;
}

const suites = {
  jest: jestTotal(),
  deno: countLiteral(
    [...sourceFiles('supabase/functions', /\.test\.ts$/), ...sourceFiles('scripts', /\.test\.ts$/)],
    /\bDeno\.test\b/g,
    /(?:for|forEach|\.map)\s*\([^)]*\bDeno\.test\b/
  ),
  database: countLiteral(
    ['supabase/tests/database.test.mjs'],
    /^\s{0,4}(?:test|it)\(/gm,
    /(?:for|forEach|\.map)\s*\([^)]*\b(?:test|it)\(/
  ),
};
const total = suites.jest + suites.deno + suites.database;

// Where each number is written down, and what it should say.
const expectations = [
  [
    'README.md',
    new RegExp(`\\| App \\(Jest\\) \\| ${suites.jest} \\|`),
    `App (Jest) | ${suites.jest}`,
  ],
  [
    'README.md',
    new RegExp(`\\| Edge functions \\(Deno\\) \\| ${suites.deno} \\|`),
    `Edge functions (Deno) | ${suites.deno}`,
  ],
  [
    'README.md',
    new RegExp(`\\| Database \\(Postgres\\) \\| ${suites.database} \\|`),
    `Database (Postgres) | ${suites.database}`,
  ],
  [
    'docs/README.tr.md',
    new RegExp(`\\| Uygulama \\(Jest\\) \\| ${suites.jest} \\|`),
    `Uygulama (Jest) | ${suites.jest}`,
  ],
  [
    'docs/README.tr.md',
    new RegExp(`\\| Edge Functions \\(Deno\\) \\| ${suites.deno} \\|`),
    `Edge Functions (Deno) | ${suites.deno}`,
  ],
  [
    'docs/README.tr.md',
    new RegExp(`\\| Veritabanı \\(Postgres\\) \\| ${suites.database} \\|`),
    `Veritabanı (Postgres) | ${suites.database}`,
  ],
  [
    'scripts/readme-art/strings.ts',
    new RegExp(`'${total}', 'automated tests'`),
    `'${total}', 'automated tests'`,
  ],
  [
    'scripts/readme-art/strings.ts',
    new RegExp(`'${total}', 'otomatik test'`),
    `'${total}', 'otomatik test'`,
  ],
];

const wrong = expectations.filter(([file, pattern]) => !pattern.test(read(file)));

console.log(
  `suites: jest ${suites.jest}, deno ${suites.deno}, database ${suites.database} — total ${total}`
);

if (wrong.length > 0) {
  console.error('\nThe documented test counts are out of date. Expected to find:\n');
  for (const [file, , expected] of wrong) console.error(`  ${file}: ${expected}`);
  console.error(
    '\nUpdate the testing tables in both READMEs, then the counts in scripts/readme-art/strings.ts' +
      ' and re-run `npm run readme:art` so the figure matches.'
  );
  process.exit(1);
}

console.log('The documented test counts match the suites.');
