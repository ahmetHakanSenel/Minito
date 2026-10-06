import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import en from '../locales/en.json';
import tr from '../locales/tr.json';

type Tree = { [key: string]: string | string[] | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      entries.set(path, value);
    } else if (Array.isArray(value)) {
      value.forEach((text, index) => entries.set(`${path}.${index}`, text));
    } else {
      for (const [nested, text] of flatten(value, path)) entries.set(nested, text);
    }
  }
  return entries;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort();
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const english = flatten(en as unknown as Tree);
const turkish = flatten(tr as unknown as Tree);
const root = join(__dirname, '..', '..', '..', '..');

describe('locales', () => {
  it('have exactly the same keys', () => {
    const missingInTurkish = [...english.keys()].filter((key) => !turkish.has(key));
    const missingInEnglish = [...turkish.keys()].filter((key) => !english.has(key));
    expect({ missingInTurkish, missingInEnglish }).toEqual({
      missingInTurkish: [],
      missingInEnglish: [],
    });
  });

  it('have no empty strings', () => {
    const empty = [...english, ...turkish].filter(([, text]) => text.trim() === '');
    expect(empty).toEqual([]);
  });

  it('use the same interpolation placeholders in both languages', () => {
    const mismatched = [...english].filter(
      ([key, text]) => placeholders(text).join() !== placeholders(turkish.get(key) ?? '').join()
    );
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });

  it('resolve every static translation key used in the code', () => {
    const files = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'src'))];
    const missing = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      // `t('a.b')` and `i18n.t("a.b")`; dynamic keys are out of reach of a static check.
      for (const match of source.matchAll(/\bt\(\s*['"]([\w-]+(?:\.[\w-]+)+)['"]/g)) {
        if (!english.has(match[1])) missing.add(`${match[1]} (${file.slice(root.length + 1)})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
