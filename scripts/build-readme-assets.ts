import { Resvg } from 'npm:@resvg/resvg-js@2.6.2';
import { MARK_PATH, SPARK_PATH } from './build-brand-assets.ts';

/**
 * Renders the README's artwork from code, in the app's own visual language, so it can be
 * regenerated whenever the numbers change.
 *
 *   npm run readme:assets
 *   npm run readme:assets -- --preview   # also writes PNG previews next to the SVGs
 *
 * Screenshots: put raw phone captures in docs/assets/screens/raw/ named 01-*.png, 02-*.png, ...
 * They are framed and laid out into docs/assets/screens.png.
 */

// Update these with the suite totals when they change (npm test, test:edge, test:db).
const NUMBERS = {
  jest: 120,
  deno: 76,
  database: 37,
  threats: 23,
  migrations: 17,
};
const TOTAL_TESTS = NUMBERS.jest + NUMBERS.deno + NUMBERS.database;

const OUT = 'docs/assets';
const FONT = "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "'JetBrains Mono', 'Cascadia Code', Consolas, 'SF Mono', monospace";

const C = {
  bg: '#050510',
  panel: '#0D0B1F',
  panelEdge: '#231D45',
  text: '#F5F3FF',
  muted: '#A1A1C2',
  faint: '#6B6890',
  violet: '#7C3AED',
  purple: '#A855F7',
  pink: '#E879F9',
  mint: '#34D399',
  sky: '#60A5FA',
  amber: '#FBBF24',
  rose: '#FB7185',
};

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sharedDefs = `
  <linearGradient id="brand" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="${C.violet}"/>
    <stop offset="0.55" stop-color="${C.purple}"/>
    <stop offset="1" stop-color="${C.pink}"/>
  </linearGradient>
  <linearGradient id="spark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#F5D0FE"/>
    <stop offset="1" stop-color="${C.pink}"/>
  </linearGradient>
  <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="60"/>
  </filter>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="14"/>
  </filter>
  <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1.1" fill="#FFFFFF" fill-opacity="0.05"/>
  </pattern>`;

function mark(x: number, y: number, size: number): string {
  const scale = size / 120;
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="${MARK_PATH}" fill="none" stroke="url(#brand)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${SPARK_PATH}" fill="url(#spark)"/>
  </g>`;
}

function pill(x: number, y: number, label: string, color: string): { svg: string; width: number } {
  const width = Math.round(label.length * 8.1 + 46);
  return {
    width,
    svg: `<g transform="translate(${x} ${y})">
      <rect width="${width}" height="36" rx="18" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-opacity="0.45"/>
      <circle cx="20" cy="18" r="4" fill="${color}"/>
      <text x="32" y="23.5" font-family="${FONT}" font-size="15" font-weight="600" fill="${C.text}">${escape(label)}</text>
    </g>`,
  };
}

function pills(x: number, y: number, items: [string, string][], gap = 10): string {
  let cursor = x;
  return items
    .map(([label, color]) => {
      const { svg, width } = pill(cursor, y, label, color);
      cursor += width + gap;
      return svg;
    })
    .join('');
}

function aurora(width: number, height: number): string {
  return `
    <rect width="${width}" height="${height}" rx="28" fill="${C.bg}"/>
    <g clip-path="url(#card)">
      <ellipse cx="${width * 0.18}" cy="${height * 0.1}" rx="360" ry="200" fill="${C.violet}" fill-opacity="0.45" filter="url(#blur)"/>
      <ellipse cx="${width * 0.86}" cy="${height * 0.95}" rx="380" ry="190" fill="${C.pink}" fill-opacity="0.22" filter="url(#blur)"/>
      <ellipse cx="${width * 0.62}" cy="${height * 0.05}" rx="260" ry="140" fill="${C.sky}" fill-opacity="0.16" filter="url(#blur)"/>
      <rect width="${width}" height="${height}" fill="url(#dots)"/>
    </g>
    <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="27.5" fill="none" stroke="#FFFFFF" stroke-opacity="0.08"/>`;
}

function frame(width: number, height: number, body: string, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(title)}">
  <title>${escape(title)}</title>
  <defs>${sharedDefs}<clipPath id="card"><rect width="${width}" height="${height}" rx="28"/></clipPath></defs>
  ${aurora(width, height)}
  ${body}
</svg>
`;
}

// ─── Hero ───────────────────────────────────────────────────────────────────────────────────────

function planCard(x: number, y: number): string {
  const steps: [string, string, string, boolean][] = [
    ['Carry three cups to the sink', '2 min', C.mint, true],
    ['Wipe the counter by the sink', '4 min', C.mint, true],
    ['Load the dishwasher halfway', '6 min', C.amber, false],
  ];
  const rows = steps
    .map(([title, minutes, color, done], i) => {
      const rowY = 150 + i * 58;
      return `<g transform="translate(24 ${rowY})">
        <rect width="392" height="46" rx="14" fill="#FFFFFF" fill-opacity="${done ? 0.05 : 0.09}"/>
        <circle cx="24" cy="23" r="10" fill="${done ? C.mint : 'none'}" stroke="${done ? C.mint : C.faint}" stroke-width="2"/>
        ${done ? `<path d="M19 23 l3.5 3.5 l6.5 -7" fill="none" stroke="${C.bg}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
        <text x="46" y="28.5" font-family="${FONT}" font-size="15" font-weight="500" fill="${done ? C.muted : C.text}"${done ? ' text-decoration="line-through"' : ''}>${escape(title)}</text>
        <rect x="318" y="12" width="60" height="22" rx="11" fill="${color}" fill-opacity="0.16"/>
        <text x="348" y="27.5" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="600" fill="${color}">${minutes}</text>
      </g>`;
    })
    .join('');

  return `<g transform="translate(${x} ${y})">
    <rect x="6" y="14" width="440" height="356" rx="24" fill="${C.violet}" fill-opacity="0.35" filter="url(#soft)"/>
    <rect width="440" height="356" rx="24" fill="${C.panel}" fill-opacity="0.92" stroke="${C.panelEdge}"/>
    <text x="24" y="40" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="1.6" fill="${C.purple}">TASK</text>
    <text x="24" y="68" font-family="${FONT}" font-size="21" font-weight="700" fill="${C.text}">Clean the kitchen before Sunday</text>
    <rect x="24" y="86" width="392" height="44" rx="12" fill="${C.pink}" fill-opacity="0.1"/>
    <text x="40" y="113" font-family="${FONT}" font-size="14" fill="${C.text}"><tspan font-weight="700" fill="${C.pink}">First, just this: </tspan>stand in the doorway and breathe once.</text>
    ${rows}
    <line x1="24" y1="330" x2="416" y2="330" stroke="#FFFFFF" stroke-opacity="0.07"/>
    <text x="24" y="350" font-family="${MONO}" font-size="12" fill="${C.faint}">source: model · task-breakdown-v2 · 3.5 s · 1,381 tokens</text>
  </g>`;
}

function hero(): string {
  const body = `
    ${mark(64, 58, 92)}
    <text x="170" y="122" font-family="${FONT}" font-size="76" font-weight="800" letter-spacing="-2" fill="${C.text}">Minito</text>
    <text x="68" y="196" font-family="${FONT}" font-size="30" font-weight="700" fill="${C.text}">An overwhelming task, turned into</text>
    <text x="68" y="236" font-family="${FONT}" font-size="30" font-weight="700" fill="url(#brand)">a laughably easy first step.</text>
    <text x="68" y="278" font-family="${FONT}" font-size="17" fill="${C.muted}">React Native · Supabase · Deno Edge Functions · OpenAI</text>
    ${pills(68, 316, [
      ['Offline-first sync', C.sky],
      ['SLOs & error budget', C.mint],
      [`${TOTAL_TESTS} tests`, C.purple],
    ])}
    ${pills(68, 362, [
      [`${NUMBERS.threats} threats modeled`, C.pink],
      ['Atomic quotas', C.amber],
    ])}
    ${planCard(776, 42)}`;
  return frame(
    1280,
    440,
    body,
    'Minito: an overwhelming task, turned into a laughably easy first step'
  );
}

// ─── Numbers ────────────────────────────────────────────────────────────────────────────────────

function numbers(): string {
  const tiles: [string, string, string][] = [
    [
      String(TOTAL_TESTS),
      'automated tests',
      `${NUMBERS.jest} app · ${NUMBERS.deno} edge · ${NUMBERS.database} SQL`,
    ],
    ['20 / 60', 'parallel calls granted', 'quota of 20, never exceeded'],
    ['99%', 'availability SLO', 'budget checked every 15 min'],
    ['6.5 s', 'p95 model latency', '20/20 valid on the first try'],
    [String(NUMBERS.threats), 'threats modeled', 'each mapped to its test'],
    ['0', 'lint warnings', 'enforced in CI'],
  ];
  const width = 1280;
  const tileWidth = (width - 48 * 2 - 16 * (tiles.length - 1)) / tiles.length;
  const body = tiles
    .map(([value, label, note], i) => {
      const x = 48 + i * (tileWidth + 16);
      return `<g transform="translate(${x} 32)">
        <rect width="${tileWidth}" height="124" rx="18" fill="#FFFFFF" fill-opacity="0.04" stroke="#FFFFFF" stroke-opacity="0.08"/>
        <text x="20" y="54" font-family="${FONT}" font-size="36" font-weight="800" fill="url(#brand)">${escape(value)}</text>
        <text x="20" y="82" font-family="${FONT}" font-size="14" font-weight="600" fill="${C.text}">${escape(label)}</text>
        <text x="20" y="104" font-family="${FONT}" font-size="11.5" fill="${C.muted}">${escape(note)}</text>
      </g>`;
    })
    .join('');
  return frame(width, 188, body, 'Minito by the numbers');
}

// ─── AI pipeline ────────────────────────────────────────────────────────────────────────────────

function node(
  x: number,
  y: number,
  w: number,
  title: string,
  subtitle: string,
  color: string
): string {
  return `<g transform="translate(${x} ${y})">
    <rect width="${w}" height="76" rx="16" fill="${C.panel}" stroke="${color}" stroke-opacity="0.7"/>
    <rect width="6" height="76" rx="3" fill="${color}"/>
    <text x="22" y="32" font-family="${FONT}" font-size="17" font-weight="700" fill="${C.text}">${escape(title)}</text>
    <text x="22" y="55" font-family="${FONT}" font-size="12.5" fill="${C.muted}">${escape(subtitle)}</text>
  </g>`;
}

function arrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label = '',
  color = C.faint,
  labelOffset: [number, number] = [0, -8]
): string {
  const midX = (x1 + x2) / 2 + labelOffset[0];
  const midY = (y1 + y2) / 2 + labelOffset[1];
  return `<g>
    <path d="M${x1} ${y1} L${x2} ${y2}" stroke="${color}" stroke-width="2" fill="none" marker-end="url(#head-${color.slice(1)})"/>
    ${label ? `<text x="${midX}" y="${midY}" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="600" fill="${color}">${escape(label)}</text>` : ''}
  </g>`;
}

function pipeline(): string {
  const colors = [C.faint, C.mint, C.amber, C.rose, C.sky];
  const markers = colors
    .map(
      (color) =>
        `<marker id="head-${color.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${color}"/></marker>`
    )
    .join('');

  const body = `
    <defs>${markers}</defs>
    <text x="48" y="58" font-family="${FONT}" font-size="13" font-weight="700" letter-spacing="1.6" fill="${C.purple}">BREAK-TASK · ONE REQUEST</text>
    <text x="48" y="88" font-family="${FONT}" font-size="24" font-weight="700" fill="${C.text}">The model is untrusted in both directions. Every path ends in a valid plan or a defined error.</text>

    ${node(48, 130, 200, 'Gatekeeping', 'JWT · body · readiness', C.sky)}
    ${node(48, 236, 200, 'Moderation + quota', '3 s timeout · atomic SQL', C.sky)}
    ${arrow(148, 206, 148, 236)}

    ${node(310, 183, 200, 'Fenced prompt', '‹ › neutralized · v2', C.purple)}
    ${arrow(248, 274, 310, 221)}

    ${node(572, 183, 196, 'Generate', 'JSON mode · 9 s/call', C.purple)}
    ${arrow(510, 221, 572, 221)}

    ${node(830, 183, 180, 'Validate', 'zod contract', C.purple)}
    ${arrow(768, 221, 830, 221)}

    ${node(1072, 130, 160, 'Plan', 'source: model', C.mint)}
    ${arrow(1010, 205, 1072, 168, 'valid', C.mint, [-6, -12])}

    ${node(830, 318, 180, 'Repair ×1', 'carries the issues', C.amber)}
    ${arrow(920, 259, 920, 318, 'invalid', C.amber, [30, 4])}
    ${node(1072, 236, 160, 'Plan', 'source: repaired', C.mint)}
    ${arrow(1010, 340, 1072, 280, 'valid', C.mint, [-14, -6])}

    ${node(1072, 342, 160, 'Fallback plan', 'deterministic', C.rose)}
    ${arrow(1010, 376, 1072, 380, 'still invalid', C.rose, [-14, 24])}

    ${node(48, 342, 200, '503 · 429 · 401', 'defined, logged errors', C.rose)}
    ${arrow(148, 312, 148, 342, '', C.rose)}

    <g transform="translate(310 318)">
      <rect width="458" height="100" rx="16" fill="#FFFFFF" fill-opacity="0.03" stroke="#FFFFFF" stroke-opacity="0.08" stroke-dasharray="5 5"/>
      <text x="22" y="32" font-family="${FONT}" font-size="15" font-weight="700" fill="${C.text}">After the reply, off the hot path</text>
      <text x="22" y="56" font-family="${MONO}" font-size="12.5" fill="${C.muted}">telemetry row · model, prompt version, latencies,</text>
      <text x="22" y="76" font-family="${MONO}" font-size="12.5" fill="${C.muted}">token split, finish reason, broken rule → SLOs</text>
    </g>`;
  return frame(1280, 450, body, 'The break-task AI pipeline');
}

// ─── Screenshots ────────────────────────────────────────────────────────────────────────────────

async function screens(): Promise<string | null> {
  const dir = `${OUT}/screens/raw`;
  const files: string[] = [];
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && /^\d+.*\.png$/i.test(entry.name)) files.push(entry.name);
    }
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  files.sort();

  const phoneWidth = 250;
  const phoneHeight = 540;
  const gap = 34;
  const width = 96 + files.length * phoneWidth + (files.length - 1) * gap;
  const height = 660;

  const phones: string[] = [];
  for (const [i, file] of files.entries()) {
    const bytes = await Deno.readFile(`${dir}/${file}`);
    const href = `data:image/png;base64,${btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))}`;
    const x = 48 + i * (phoneWidth + gap);
    const y = 48 + (i % 2 === 1 ? 24 : 0);
    const label = file
      .replace(/^\d+[-_]?/, '')
      .replace(/\.png$/i, '')
      .replace(/[-_]/g, ' ');
    phones.push(`<g transform="translate(${x} ${y})">
      <rect x="4" y="18" width="${phoneWidth}" height="${phoneHeight}" rx="38" fill="${C.violet}" fill-opacity="0.35" filter="url(#soft)"/>
      <rect width="${phoneWidth}" height="${phoneHeight}" rx="38" fill="#0A0A14" stroke="#2A2550" stroke-width="2"/>
      <clipPath id="screen-${i}"><rect x="9" y="9" width="${phoneWidth - 18}" height="${phoneHeight - 18}" rx="30"/></clipPath>
      <image href="${href}" x="9" y="9" width="${phoneWidth - 18}" height="${phoneHeight - 18}" preserveAspectRatio="xMidYMid slice" clip-path="url(#screen-${i})"/>
      <text x="${phoneWidth / 2}" y="${phoneHeight + 44}" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="600" fill="${C.text}">${escape(label)}</text>
    </g>`);
  }
  return frame(width, height, phones.join(''), 'Minito screens');
}

// ─── Output ─────────────────────────────────────────────────────────────────────────────────────

async function write(name: string, svg: string, preview: boolean, raster: boolean) {
  if (raster) {
    // Embedded screenshots make a large SVG; the README uses a PNG instead.
    const png = new Resvg(svg, {
      fitTo: { mode: 'zoom', value: 1.5 },
      font: { loadSystemFonts: true },
    })
      .render()
      .asPng();
    await Deno.writeFile(`${OUT}/${name}.png`, png);
    console.log(`${OUT}/${name}.png  ${png.length} bytes`);
    return;
  }
  await Deno.writeTextFile(`${OUT}/${name}.svg`, svg);
  console.log(`${OUT}/${name}.svg  ${svg.length} bytes`);
  if (preview) {
    const png = new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();
    await Deno.writeFile(`${OUT}/${name}.preview.png`, png);
  }
}

if (import.meta.main) {
  const preview = Deno.args.includes('--preview');
  await Deno.mkdir(OUT, { recursive: true });
  await write('hero', hero(), preview, false);
  await write('numbers', numbers(), preview, false);
  await write('pipeline', pipeline(), preview, false);
  const collage = await screens();
  if (collage) await write('screens', collage, false, true);
  else console.log(`No screenshots in ${OUT}/screens/raw yet; skipped screens.png`);
}
