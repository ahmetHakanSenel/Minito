import opentype from 'npm:opentype.js@1.3.4';

/**
 * Typesetting for the README artwork.
 *
 * Text is converted to vector outlines, so every figure looks the same on every machine and every
 * width is known before layout. Each glyph is defined once per SVG and placed with <use>, which
 * keeps the files small. Fonts are Inter and JetBrains Mono (SIL OFL), fetched at build time.
 */

type Font = opentype.Font;

export type Family = 'sans' | 'mono';
export type Weight = 400 | 500 | 600;

export type TextStyle = {
  family: Family;
  weight: Weight;
  size: number;
  /** Extra space between letters, in em. */
  tracking?: number;
  upper?: boolean;
};

const FONT_VERSION = '5.3.0';
const PACKAGES: Record<Family, string> = { sans: 'inter', mono: 'jetbrains-mono' };

type FontPair = { primary: Font; fallback: Font; key: string };

const cache = new Map<string, Promise<FontPair>>();

async function fetchFont(pkg: string, subset: string, weight: Weight): Promise<Font> {
  const url = `https://cdn.jsdelivr.net/npm/@fontsource/${pkg}@${FONT_VERSION}/files/${pkg}-${subset}-${weight}-normal.woff`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`font download failed (${response.status}): ${url}`);
  return opentype.parse(await response.arrayBuffer());
}

/** The Latin subset carries kerning for most text; Latin Extended covers ğ, ş, İ and friends. */
export function loadFont(family: Family, weight: Weight): Promise<FontPair> {
  const key = `${family === 'sans' ? 's' : 'm'}${weight}`;
  let pending = cache.get(key);
  if (!pending) {
    const pkg = PACKAGES[family];
    pending = Promise.all([
      fetchFont(pkg, 'latin', weight),
      fetchFont(pkg, 'latin-ext', weight),
    ]).then(([primary, fallback]) => ({ primary, fallback, key }));
    cache.set(key, pending);
  }
  return pending;
}

export async function preloadFonts(): Promise<void> {
  const styles: [Family, Weight][] = [
    ['sans', 400],
    ['sans', 500],
    ['sans', 600],
    ['mono', 400],
    ['mono', 500],
  ];
  await Promise.all(styles.map(([family, weight]) => loadFont(family, weight)));
}

function loaded(style: TextStyle): FontPair {
  const key = `${style.family === 'sans' ? 's' : 'm'}${style.weight}`;
  const pair = resolvedFonts.get(key);
  if (!pair) throw new Error(`font ${key} was not preloaded`);
  return pair;
}

const resolvedFonts = new Map<string, FontPair>();

// Upper-casing is language-specific: Turkish "i" becomes "İ", not "I".
let locale = 'en-US';

export function setLocale(value: string): void {
  locale = value;
}

export async function resolveFonts(): Promise<void> {
  await preloadFonts();
  for (const [key, pending] of cache) resolvedFonts.set(key, await pending);
}

type PlacedGlyph = { id: string; x: number; path: string };

/** Splits text into runs that one font can set, so kerning is kept within each run. */
function runs(text: string, pair: FontPair): { font: Font; tag: string; text: string }[] {
  const result: { font: Font; tag: string; text: string }[] = [];
  for (const char of text) {
    const inPrimary = char === ' ' || pair.primary.charToGlyph(char).index !== 0;
    if (!inPrimary && pair.fallback.charToGlyph(char).index === 0) {
      throw new Error(
        `no glyph for "${char}" (U+${char.codePointAt(0)!.toString(16)}) in "${text}"`
      );
    }
    const font = inPrimary ? pair.primary : pair.fallback;
    const tag = inPrimary ? 'a' : 'b';
    const last = result[result.length - 1];
    if (last && last.tag === tag) last.text += char;
    else result.push({ font, tag, text: char });
  }
  return result;
}

/** Glyph placements in font units, starting at 0. */
function layout(
  text: string,
  style: TextStyle
): { glyphs: PlacedGlyph[]; width: number; units: number } {
  const pair = loaded(style);
  const units = pair.primary.unitsPerEm;
  const content = style.upper ? text.toLocaleUpperCase(locale) : text;
  const tracking = (style.tracking ?? 0) * units;
  const glyphs: PlacedGlyph[] = [];
  let cursor = 0;

  for (const run of runs(content, pair)) {
    const positions: { glyph: opentype.Glyph; x: number }[] = [];
    run.font.forEachGlyph(
      run.text,
      0,
      0,
      units,
      { kerning: true, features: { liga: false, rlig: false } },
      (glyph: opentype.Glyph, x: number) => {
        positions.push({ glyph, x });
      }
    );
    positions.forEach(({ glyph, x }, i) => {
      const id = `${pair.key}${run.tag}${glyph.index}`;
      glyphs.push({
        id,
        x: cursor + x + i * tracking,
        path: glyph.getPath(0, 0, units).toPathData(0),
      });
    });
    const advance = run.font.getAdvanceWidth(run.text, units, {
      kerning: true,
      features: { liga: false, rlig: false },
    });
    cursor += advance + [...run.text].length * tracking;
  }
  // Trailing tracking is not part of the visible width.
  const width = cursor - (tracking > 0 ? tracking : 0);
  return { glyphs, width, units };
}

export function measure(text: string, style: TextStyle): number {
  const { width, units } = layout(text, style);
  return (width * style.size) / units;
}

/** Greedy word wrap at a measured width. */
export function wrap(text: string, style: TextStyle, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate, style) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export type Anchor = 'start' | 'middle' | 'end';

/** Every label that did not fit, collected so one build reports all of them. */
export const overflows: string[] = [];

/** Collects the glyphs one SVG uses and emits them once. */
export class GlyphSheet {
  private readonly defs = new Map<string, string>();

  /**
   * Draws `text` with its baseline at y. With `maxWidth`, text that would not fit is a build
   * error, not a surprise on GitHub.
   */
  text(
    x: number,
    y: number,
    text: string,
    style: TextStyle,
    color: string,
    options: { anchor?: Anchor; maxWidth?: number } = {}
  ): string {
    if (!text) return '';
    const { glyphs, width, units } = layout(text, style);
    const scale = style.size / units;
    const pixelWidth = width * scale;
    if (options.maxWidth !== undefined && pixelWidth > options.maxWidth + 0.5) {
      overflows.push(
        `"${text}" is ${pixelWidth.toFixed(1)}px wide, over its ${Math.floor(options.maxWidth)}px limit`
      );
    }
    const anchor = options.anchor ?? 'start';
    const left = anchor === 'start' ? x : anchor === 'middle' ? x - pixelWidth / 2 : x - pixelWidth;

    const uses = glyphs
      .map((glyph) => {
        if (!this.defs.has(glyph.id)) this.defs.set(glyph.id, glyph.path);
        return glyph.path ? `<use href="#${glyph.id}" x="${Math.round(glyph.x)}"/>` : '';
      })
      .join('');
    return `<g transform="translate(${r(left)} ${r(y)}) scale(${scale.toFixed(5)})" fill="${color}">${uses}</g>`;
  }

  width(text: string, style: TextStyle): number {
    return measure(text, style);
  }

  definitions(): string {
    return [...this.defs]
      .filter(([, d]) => d)
      .map(([id, d]) => `<path id="${id}" d="${d}"/>`)
      .join('');
  }
}

export const r = (value: number) => Math.round(value * 100) / 100;
