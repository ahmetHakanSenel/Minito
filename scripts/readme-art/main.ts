import { Resvg } from 'npm:@resvg/resvg-js@2.6.2';
import { MARK_PATH, SPARK_PATH } from '../build-brand-assets.ts';
import {
  type Anchor,
  GlyphSheet,
  overflows,
  r,
  resolveFonts,
  setLocale,
  type TextStyle,
  wrap,
} from './type.ts';
import { STRINGS, type Lang, type Strings } from './strings.ts';

/**
 * Renders the README figures, in English and Turkish, for light and dark GitHub themes.
 *
 *   npm run readme:art                # docs/assets/<figure>-<lang>-<theme>.svg
 *   npm run readme:art -- --preview   # plus PNG previews (git-ignored)
 *
 * The visual language is deliberately quiet: flat surfaces, hairlines, one accent, real
 * typography. Every label is measured, and one that would overflow its box fails the build.
 */

// ─── Theme ──────────────────────────────────────────────────────────────────────────────────────

type Theme = {
  name: 'light' | 'dark';
  bg: string;
  zone: string;
  panel: string;
  line: string;
  strong: string;
  text: string;
  sub: string;
  faint: string;
  accent: string;
  accentWash: number;
  ok: string;
  warn: string;
  bad: string;
};

const THEMES: Theme[] = [
  {
    name: 'light',
    bg: '#FFFFFF',
    zone: '#F8F8FA',
    panel: '#FFFFFF',
    line: '#E4E5EA',
    strong: '#B9BDC7',
    text: '#0E1116',
    sub: '#4E5564',
    faint: '#858B98',
    accent: '#6A4FD1',
    accentWash: 0.07,
    ok: '#16915A',
    warn: '#B26F12',
    bad: '#CC3A43',
  },
  {
    name: 'dark',
    bg: '#0B0C10',
    zone: '#0F1015',
    panel: '#14151B',
    line: '#262831',
    strong: '#434855',
    text: '#ECEDF1',
    sub: '#A2A7B4',
    faint: '#6D7280',
    accent: '#9B8CFA',
    accentWash: 0.11,
    ok: '#4CC38A',
    warn: '#E2A546',
    bad: '#EE6B72',
  },
];

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'accent';

const toneColor = (t: Theme, tone: Tone) =>
  tone === 'neutral' ? t.strong : tone === 'accent' ? t.accent : t[tone];

// ─── Type scale ─────────────────────────────────────────────────────────────────────────────────

const T = {
  display: { family: 'sans', weight: 600, size: 44, tracking: -0.022 },
  heading: { family: 'sans', weight: 600, size: 22, tracking: -0.012 },
  wordmark: { family: 'sans', weight: 600, size: 21, tracking: -0.01 },
  cardTitle: { family: 'sans', weight: 600, size: 19, tracking: -0.01 },
  value: { family: 'sans', weight: 600, size: 28, tracking: -0.02 },
  body: { family: 'sans', weight: 400, size: 17 },
  node: { family: 'sans', weight: 600, size: 14 },
  label: { family: 'sans', weight: 500, size: 13 },
  row: { family: 'sans', weight: 400, size: 14.5 },
  small: { family: 'sans', weight: 400, size: 13 },
  code: { family: 'mono', weight: 400, size: 11.5 },
  detail: { family: 'mono', weight: 400, size: 11 },
  tag: { family: 'mono', weight: 500, size: 11, tracking: 0.08, upper: true },
  badge: { family: 'mono', weight: 500, size: 10.5 },
} satisfies Record<string, TextStyle>;

// ─── Figure ─────────────────────────────────────────────────────────────────────────────────────

class Figure {
  readonly sheet = new GlyphSheet();
  private readonly parts: string[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
    readonly t: Theme,
    readonly title: string
  ) {}

  add(...svg: string[]) {
    this.parts.push(...svg);
  }

  text(
    x: number,
    y: number,
    value: string,
    style: TextStyle,
    color: string,
    options: { anchor?: Anchor; maxWidth?: number } = {}
  ) {
    this.add(this.sheet.text(x, y, value, style, color, options));
  }

  measure(value: string, style: TextStyle) {
    return this.sheet.width(value, style);
  }

  svg(): string {
    const { width: w, height: h, t } = this;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(this.title)}">
<title>${escapeXml(this.title)}</title>
<defs>${this.sheet.definitions()}</defs>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="14" fill="${t.bg}" stroke="${t.line}"/>
${this.parts.join('\n')}
</svg>
`;
  }
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function mark(f: Figure, x: number, y: number, size: number) {
  // The mark's outline spans 19.5–111 × 10–100.5 in its 120 grid.
  const scale = size / 91.5;
  f.add(`<g transform="translate(${r(x - 19.5 * scale)} ${r(y - 10 * scale)}) scale(${r(scale)})">
  <path d="${MARK_PATH}" fill="none" stroke="${f.t.accent}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${SPARK_PATH}" fill="${f.t.accent}"/>
</g>`);
}

type Box = { x: number; y: number; w: number; h: number };

const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;
const right = (b: Box) => b.x + b.w;
const bottom = (b: Box) => b.y + b.h;

function node(
  f: Figure,
  b: Box,
  title: string,
  sub: string,
  options: { tone?: Tone; dashed?: boolean } = {}
) {
  const { t } = f;
  const tone = options.tone ?? 'neutral';
  f.add(
    `<rect x="${b.x + 0.5}" y="${b.y + 0.5}" width="${b.w - 1}" height="${b.h - 1}" rx="8" fill="${t.panel}" stroke="${options.dashed ? t.strong : t.line}"${options.dashed ? ' stroke-dasharray="4 4"' : ''}/>`
  );
  if (tone !== 'neutral') {
    f.add(
      `<rect x="${b.x + 8}" y="${b.y + 14}" width="2" height="${b.h - 28}" rx="1" fill="${toneColor(t, tone)}"/>`
    );
  }
  const inset = tone === 'neutral' ? 16 : 22;
  const maxWidth = b.w - inset - 14;
  if (sub) {
    f.text(b.x + inset, cy(b) - 3, title, T.node, t.text, { maxWidth });
    f.text(b.x + inset, cy(b) + 15, sub, T.detail, t.faint, { maxWidth });
  } else {
    f.text(b.x + inset, cy(b) + 5, title, T.node, t.text, { maxWidth });
  }
}

type Point = [number, number];

/** An orthogonal connector with an arrowhead at the last point, and an optional label. */
function connector(
  f: Figure,
  points: Point[],
  options: {
    label?: string;
    at?: Point;
    dashed?: boolean;
    color?: string;
    head?: boolean;
    /** Background behind the label; the zone color when the label sits inside a zone. */
    labelBg?: string;
  } = {}
) {
  const { t } = f;
  const color = options.color ?? t.strong;
  const [ex, ey] = points[points.length - 1];
  const [px, py] = points[points.length - 2];
  const head = options.head ?? true;
  // Stop the line where the arrowhead begins, so the two never overlap.
  const trimmed = points.map((p) => [...p] as Point);
  if (head) {
    const last = trimmed[trimmed.length - 1];
    last[0] -= Math.sign(ex - px) * 5;
    last[1] -= Math.sign(ey - py) * 5;
  }
  const d = trimmed.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r(x)} ${r(y)}`).join(' ');
  f.add(
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.25" stroke-linejoin="round"${options.dashed ? ' stroke-dasharray="4 4"' : ''}/>`
  );
  if (head) {
    const angle = Math.atan2(ey - py, ex - px);
    const tip = (dx: number, dy: number): string => {
      const x = ex + dx * Math.cos(angle) - dy * Math.sin(angle);
      const y = ey + dx * Math.sin(angle) + dy * Math.cos(angle);
      return `${r(x)} ${r(y)}`;
    };
    f.add(`<path d="M${tip(0, 0)} L${tip(-7, -3.5)} L${tip(-7, 3.5)} Z" fill="${color}"/>`);
  }
  if (options.label && options.at) {
    edgeLabel(f, options.at, options.label, options.labelBg);
  }
}

function edgeLabel(f: Figure, [x, y]: Point, value: string, background?: string) {
  const width = f.measure(value, T.code);
  f.add(
    `<rect x="${r(x - width / 2 - 6)}" y="${r(y - 9)}" width="${r(width + 12)}" height="18" rx="4" fill="${background ?? f.t.bg}"/>`
  );
  f.text(x, y + 4, value, T.code, f.t.sub, { anchor: 'middle' });
}

function zone(f: Figure, b: Box, label: string) {
  f.add(
    `<rect x="${b.x + 0.5}" y="${b.y + 0.5}" width="${b.w - 1}" height="${b.h - 1}" rx="12" fill="${f.t.zone}" stroke="${f.t.line}" stroke-dasharray="3 5"/>`
  );
  f.text(b.x + 20, b.y + 28, label, T.tag, f.t.faint, { maxWidth: b.w - 40 });
}

function header(f: Figure, tag: string, heading: string) {
  f.text(56, 56, tag, T.tag, f.t.accent);
  f.text(56, 88, heading, T.heading, f.t.text, { maxWidth: f.width - 112 });
}

function check(f: Figure, x: number, y: number, done: boolean) {
  const { t } = f;
  if (done) {
    f.add(`<rect x="${x}" y="${y}" width="16" height="16" rx="4.5" fill="${t.accent}"/>`);
    f.add(
      `<path d="M${x + 4.2} ${y + 8.4} l2.6 2.6 l5 -5.4" fill="none" stroke="${t.bg}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  } else {
    f.add(
      `<rect x="${x + 0.5}" y="${y + 0.5}" width="15" height="15" rx="4" fill="none" stroke="${t.strong}"/>`
    );
  }
}

// ─── Hero ───────────────────────────────────────────────────────────────────────────────────────

function hero(t: Theme, s: Strings): Figure {
  const f = new Figure(1280, 440, t, s.hero.alt);

  mark(f, 64, 55, 26);
  f.text(102, 76, 'Minito', T.wordmark, t.text);
  const wordEnd = 102 + f.measure('Minito', T.wordmark);
  f.add(`<rect x="${r(wordEnd + 16)}" y="61" width="1" height="18" fill="${t.line}"/>`);
  f.text(wordEnd + 33, 75, s.hero.kicker, T.tag, t.faint);

  f.text(64, 158, s.hero.line1, T.display, t.text, { maxWidth: 620 });
  let x = 64;
  for (const [part, accent] of s.hero.line2) {
    f.text(x, 212, part, T.display, accent ? t.accent : t.text);
    x += f.measure(part, T.display);
  }
  if (x - 64 > 620) throw new Error('hero line 2 is too wide');

  wrap(s.hero.body, T.body, 560).forEach((line, i) => {
    f.text(64, 262 + i * 27, line, T.body, t.sub);
  });

  let stackX = 64;
  s.hero.stack.forEach((item, i) => {
    if (i > 0) {
      f.add(`<rect x="${r(stackX)}" y="${363}" width="1" height="14" fill="${t.line}"/>`);
      stackX += 14;
    }
    f.text(stackX, 374, item, T.tag, t.faint);
    stackX += f.measure(item, T.tag) + 14;
  });
  if (stackX > 680) throw new Error('hero stack row is too wide');

  // The product, as a plan card.
  const card: Box = { x: 720, y: 50, w: 496, h: 340 };
  f.add(
    `<rect x="${card.x + 0.5}" y="${card.y + 0.5}" width="${card.w - 1}" height="${card.h - 1}" rx="12" fill="${t.panel}" stroke="${t.line}"/>`
  );
  f.text(card.x + 24, card.y + 36, s.hero.cardTag, T.tag, t.faint);
  f.text(right(card) - 24, card.y + 36, s.hero.cardMeta, T.tag, t.faint, { anchor: 'end' });
  f.text(card.x + 24, card.y + 70, s.hero.task, T.cardTitle, t.text, { maxWidth: card.w - 48 });

  const callout: Box = { x: card.x + 24, y: card.y + 88, w: card.w - 48, h: 56 };
  f.add(
    `<rect x="${callout.x}" y="${callout.y}" width="${callout.w}" height="${callout.h}" rx="8" fill="${t.accent}" fill-opacity="${t.accentWash}"/>`,
    `<rect x="${callout.x}" y="${callout.y}" width="2" height="${callout.h}" fill="${t.accent}"/>`
  );
  f.text(callout.x + 16, callout.y + 22, s.hero.startHere, T.tag, t.accent);
  f.text(callout.x + 16, callout.y + 43, s.hero.firstAction, T.row, t.text, {
    maxWidth: callout.w - 32,
  });

  s.hero.steps.forEach(([title, minutes, done], i) => {
    const rowY = card.y + 156 + i * 44;
    if (i > 0)
      f.add(
        `<rect x="${card.x + 24}" y="${rowY}" width="${card.w - 48}" height="1" fill="${t.line}"/>`
      );
    check(f, card.x + 24, rowY + 15, done);
    const color = done ? t.faint : t.text;
    f.text(card.x + 54, rowY + 28, title, T.row, color, { maxWidth: card.w - 150 });
    if (done) {
      const width = f.measure(title, T.row);
      f.add(
        `<rect x="${card.x + 54}" y="${rowY + 23}" width="${r(width)}" height="1" fill="${t.faint}"/>`
      );
    }
    f.text(right(card) - 24, rowY + 28, minutes, T.code, t.faint, { anchor: 'end' });
  });

  f.add(
    `<rect x="${card.x}" y="${bottom(card) - 44}" width="${card.w}" height="1" fill="${t.line}"/>`
  );
  f.text(card.x + 24, bottom(card) - 17, s.hero.footer, T.code, t.faint, {
    maxWidth: card.w - 48,
  });
  return f;
}

// ─── Numbers ────────────────────────────────────────────────────────────────────────────────────

function numbers(t: Theme, s: Strings): Figure {
  const f = new Figure(1280, 168, t, s.numbers.alt);
  const groups = s.numbers.groups;
  const total = groups.reduce((n, group) => n + group.items.length, 0);
  // Columns keep one width across both groups, so a wider group is wider on the page rather
  // than more crowded, and the two never look like different kinds of measurement.
  const columnWidth = (1280 - 48) / total;

  let column = 0;
  groups.forEach((group, groupIndex) => {
    const groupX = 24 + column * columnWidth;
    const groupWidth = group.items.length * columnWidth;

    // The caption is what separates a number that CI proves from a number that came off a
    // 20-task evaluation run.
    f.text(groupX + 24, 34, group.caption, T.tag, t.accent, { maxWidth: groupWidth - 44 });

    // A full-height rule between groups; a hairline between columns inside one.
    if (groupIndex > 0) {
      f.add(`<rect x="${r(groupX - 1)}" y="14" width="1" height="140" fill="${t.strong}"/>`);
    }

    group.items.forEach(([value, label, note], i) => {
      const x = groupX + i * columnWidth;
      if (i > 0) f.add(`<rect x="${r(x)}" y="72" width="1" height="64" fill="${t.line}"/>`);
      const maxWidth = columnWidth - 44;
      f.text(x + 24, 100, value, T.value, t.text, { maxWidth });
      f.text(x + 24, 122, label, T.label, t.text, { maxWidth });
      f.text(x + 24, 140, note, T.code, t.faint, { maxWidth });
    });

    column += group.items.length;
  });
  return f;
}

// ─── Pipeline ───────────────────────────────────────────────────────────────────────────────────

function pipeline(t: Theme, s: Strings): Figure {
  const p = s.pipeline;
  const f = new Figure(1280, 500, t, p.alt);
  header(f, p.tag, p.heading);

  const w = 172;
  const h = 60;
  // The outcome column stands apart, so the branch labels have room.
  const outcomeGap = 72;
  const outcomeWidth = 164;
  const gap = (1168 - 5 * w - outcomeGap - outcomeWidth) / 4;
  const col = (i: number) => (i < 5 ? 56 + i * (w + gap) : 1224 - outcomeWidth);
  const row1 = 150;
  const row2 = 280;
  const row3 = 400;
  const at = (i: number, y: number): Box => ({ x: col(i), y, w: i < 5 ? w : outcomeWidth, h });

  const gate = at(0, row1);
  const guard = at(1, row1);
  const fence = at(2, row1);
  const generate = at(3, row1);
  const validate = at(4, row1);
  const planModel = at(5, row1);
  const errors = at(0, row2);
  const repair = at(4, row2);
  const planRepaired = at(5, row2);
  const fallback = at(5, row3);

  node(f, gate, p.gate[0], p.gate[1]);
  node(f, guard, p.guard[0], p.guard[1]);
  node(f, fence, p.fence[0], p.fence[1]);
  node(f, generate, p.generate[0], p.generate[1]);
  node(f, validate, p.validate[0], p.validate[1]);
  node(f, planModel, p.planModel[0], p.planModel[1], { tone: 'ok' });
  node(f, errors, p.errors[0], p.errors[1], { tone: 'bad' });
  node(f, repair, p.repair[0], p.repair[1], { tone: 'warn' });
  node(f, planRepaired, p.planRepaired[0], p.planRepaired[1], { tone: 'ok' });
  node(f, fallback, p.fallback[0], p.fallback[1], { tone: 'warn' });

  for (const [from, to] of [
    [gate, guard],
    [guard, fence],
    [fence, generate],
    [generate, validate],
  ] as const) {
    connector(f, [
      [right(from), cy(from)],
      [to.x, cy(to)],
    ]);
  }
  const midGap = (a: Box, b: Box) => (right(a) + b.x) / 2;
  connector(
    f,
    [
      [right(validate), cy(validate)],
      [planModel.x, cy(planModel)],
    ],
    {
      label: p.valid,
      at: [midGap(validate, planModel) - 3, cy(validate)],
      color: t.ok,
    }
  );
  connector(
    f,
    [
      [cx(validate), bottom(validate)],
      [cx(repair), repair.y],
    ],
    {
      label: p.invalid,
      at: [cx(validate), (bottom(validate) + repair.y) / 2],
      color: t.warn,
    }
  );
  connector(
    f,
    [
      [right(repair), cy(repair)],
      [planRepaired.x, cy(planRepaired)],
    ],
    {
      label: p.valid,
      at: [midGap(repair, planRepaired) - 3, cy(repair)],
      color: t.ok,
    }
  );
  connector(
    f,
    [
      [cx(repair), bottom(repair)],
      [cx(repair), cy(fallback)],
      [fallback.x, cy(fallback)],
    ],
    { label: p.stillInvalid, at: [(cx(repair) + fallback.x) / 2, cy(fallback)], color: t.warn }
  );
  connector(
    f,
    [
      [cx(gate), bottom(gate)],
      [cx(errors), errors.y],
    ],
    {
      label: p.rejected,
      at: [cx(gate), (bottom(gate) + errors.y) / 2],
      color: t.bad,
    }
  );
  connector(
    f,
    [
      [cx(guard), bottom(guard)],
      [cx(guard), cy(errors)],
      [right(errors), cy(errors)],
    ],
    { label: p.limited, at: [cx(guard), (bottom(guard) + cy(errors)) / 2 - 8], color: t.bad }
  );

  // Off the hot path.
  const band: Box = { x: fence.x, y: row2, w: right(generate) - fence.x, h: 136 };
  f.add(
    `<rect x="${band.x + 0.5}" y="${band.y + 0.5}" width="${band.w - 1}" height="${band.h - 1}" rx="10" fill="${t.zone}" stroke="${t.line}" stroke-dasharray="3 5"/>`
  );
  f.text(band.x + 20, band.y + 30, p.afterTag, T.tag, t.faint);
  f.text(band.x + 20, band.y + 56, p.afterTitle, T.node, t.text, { maxWidth: band.w - 40 });
  wrap(p.afterBody, T.small, band.w - 40).forEach((line, i) => {
    f.text(band.x + 20, band.y + 80 + i * 19, line, T.small, t.sub);
  });
  return f;
}

// ─── Architecture ───────────────────────────────────────────────────────────────────────────────

function architecture(t: Theme, s: Strings): Figure {
  const a = s.architecture;
  const f = new Figure(1280, 630, t, a.alt);
  header(f, a.tag, a.heading);

  const device: Box = { x: 40, y: 124, w: 360, h: 474 };
  const cloud: Box = { x: 500, y: 124, w: 420, h: 474 };
  const vendors: Box = { x: 980, y: 124, w: 260, h: 474 };
  zone(f, device, a.device);
  zone(f, cloud, a.cloud);
  zone(f, vendors, a.vendors);

  const h = 58;
  const left = (y: number): Box => ({ x: 56, y, w: 152, h });
  const rightCol = (y: number): Box => ({ x: 232, y, w: 152, h });
  const screens: Box = { x: 56, y: 172, w: 328, h };
  const controllers: Box = { x: 56, y: 256, w: 328, h };
  const sync = left(352);
  const repositories = rightCol(352);
  const local = left(460);
  const session = rightCol(460);

  const auth: Box = { x: 516, y: 172, w: 180, h };
  const breakTask: Box = { x: 516, y: 272, w: 388, h };
  const postgres: Box = { x: 516, y: 388, w: 388, h: 90 };
  const cron: Box = { x: 516, y: 516, w: 160, h };
  const ops: Box = { x: 744, y: 516, w: 160, h };

  const moderation: Box = { x: 996, y: 176, w: 228, h };
  const model: Box = { x: 996, y: 272, w: 228, h };
  const webhook: Box = { x: 996, y: 516, w: 228, h };

  node(f, screens, a.screens[0], a.screens[1]);
  node(f, controllers, a.controllers[0], a.controllers[1]);
  node(f, sync, a.sync[0], a.sync[1], { tone: 'accent' });
  node(f, repositories, a.repositories[0], a.repositories[1]);
  node(f, local, a.local[0], a.local[1]);
  node(f, session, a.session[0], a.session[1]);
  node(f, auth, a.auth[0], a.auth[1]);
  node(f, breakTask, a.breakTask[0], a.breakTask[1], { tone: 'accent' });
  node(f, cron, a.cron[0], a.cron[1]);
  node(f, ops, a.ops[0], a.ops[1]);
  node(f, moderation, a.moderation[0], a.moderation[1]);
  node(f, model, a.model[0], a.model[1]);
  node(f, webhook, a.webhook[0], a.webhook[1], { dashed: true });

  // Postgres gets a taller card listing what it holds.
  f.add(
    `<rect x="${postgres.x + 0.5}" y="${postgres.y + 0.5}" width="${postgres.w - 1}" height="${postgres.h - 1}" rx="8" fill="${t.panel}" stroke="${t.line}"/>`,
    `<rect x="${postgres.x + 8}" y="${postgres.y + 14}" width="2" height="${postgres.h - 28}" rx="1" fill="${t.accent}"/>`
  );
  f.text(postgres.x + 22, postgres.y + 28, a.postgres[0], T.node, t.text);
  f.text(postgres.x + 22, postgres.y + 51, a.postgres[1], T.code, t.faint, {
    maxWidth: postgres.w - 40,
  });
  f.text(postgres.x + 22, postgres.y + 70, a.postgres[2], T.code, t.faint, {
    maxWidth: postgres.w - 40,
  });

  // Inside the device.
  const down = (from: Box, to: Box, x = cx(to)) =>
    connector(f, [
      [x, bottom(from)],
      [x, to.y],
    ]);
  down(screens, controllers, cx(controllers));
  down(controllers, sync);
  down(controllers, repositories);
  down(sync, local);
  down(repositories, session);

  // Device to cloud.
  connector(
    f,
    [
      [right(repositories), cy(repositories) - 12],
      [440, cy(repositories) - 12],
      [440, cy(breakTask)],
      [breakTask.x, cy(breakTask)],
    ],
    { label: a.https, at: [440, (cy(repositories) - 12 + cy(breakTask)) / 2] }
  );
  connector(
    f,
    [
      [right(repositories), cy(repositories) + 12],
      [postgres.x, cy(repositories) + 12],
    ],
    {
      label: a.rest,
      at: [450, cy(repositories) + 12],
    }
  );
  connector(
    f,
    [
      [right(sync), cy(sync)],
      [220, cy(sync)],
      [220, 566],
      [452, 566],
      [452, bottom(postgres) - 16],
      [postgres.x, bottom(postgres) - 16],
    ],
    { label: a.syncEdge, at: [452, (566 + bottom(postgres) - 16) / 2 + 4] }
  );

  // Inside the cloud.
  connector(
    f,
    [
      [cx(auth), breakTask.y],
      [cx(auth), bottom(auth)],
    ],
    {
      label: a.verify,
      at: [cx(auth), (bottom(auth) + breakTask.y) / 2],
      labelBg: t.zone,
    }
  );
  connector(
    f,
    [
      [right(breakTask) - 110, bottom(breakTask)],
      [right(breakTask) - 110, postgres.y],
    ],
    {
      label: a.quota,
      at: [right(breakTask) - 110, (bottom(breakTask) + postgres.y) / 2],
      labelBg: t.zone,
    }
  );
  connector(f, [
    [right(cron), cy(cron)],
    [ops.x, cy(ops)],
  ]);
  connector(
    f,
    [
      [cx(ops), ops.y],
      [cx(ops), bottom(postgres)],
    ],
    {
      label: a.snapshot,
      at: [cx(ops), (ops.y + bottom(postgres)) / 2],
      labelBg: t.zone,
    }
  );

  // Cloud to providers.
  connector(
    f,
    [
      [right(breakTask) - 36, breakTask.y],
      [right(breakTask) - 36, cy(moderation)],
      [moderation.x, cy(moderation)],
    ],
    { label: a.moderate, at: [950, cy(moderation)] }
  );
  connector(
    f,
    [
      [right(breakTask), cy(breakTask)],
      [model.x, cy(model)],
    ],
    {
      label: a.generate,
      at: [950, cy(model)],
    }
  );
  connector(
    f,
    [
      [right(ops), cy(ops)],
      [webhook.x, cy(webhook)],
    ],
    {
      dashed: true,
      label: a.optional,
      at: [950, cy(webhook)],
    }
  );
  return f;
}

// ─── Sync sequence ──────────────────────────────────────────────────────────────────────────────

function sync(t: Theme, s: Strings): Figure {
  const q = s.sync;
  const f = new Figure(1280, 650, t, q.alt);
  header(f, q.tag, q.heading);

  const columns = [200, 493, 787, 1080];
  const top = 128;
  q.participants.forEach(([title, sub], i) => {
    node(f, { x: columns[i] - 115, y: top, w: 230, h: 58 }, title, sub, {
      tone: i === 2 ? 'accent' : 'neutral',
    });
  });
  const lifelineTop = top + 58;
  const lifelineBottom = 620;
  for (const x of columns) {
    f.add(
      `<path d="M${x} ${lifelineTop} V${lifelineBottom}" stroke="${t.line}" stroke-width="1.25" stroke-dasharray="3 5"/>`
    );
  }

  let step = 0;
  const message = (
    from: number,
    to: number,
    y: number,
    title: string,
    detail: string,
    dashed = false
  ) => {
    step += 1;
    const x1 = columns[from];
    const x2 = columns[to];
    const direction = Math.sign(x2 - x1);
    connector(
      f,
      [
        [x1 + direction * 14, y],
        [x2, y],
      ],
      { dashed }
    );
    const mid = (x1 + x2) / 2;
    const span = Math.abs(x2 - x1) - 60;
    f.text(mid, y - (detail ? 25 : 10), title, T.label, t.text, {
      anchor: 'middle',
      maxWidth: span,
    });
    if (detail) f.text(mid, y - 9, detail, T.code, t.faint, { anchor: 'middle', maxWidth: span });
    f.add(`<circle cx="${x1}" cy="${y}" r="10" fill="${t.bg}" stroke="${t.strong}"/>`);
    f.text(x1, y + 3.8, String(step), T.badge, t.sub, { anchor: 'middle' });
  };

  message(0, 1, 246, q.edit[0], q.edit[1]);
  message(1, 0, 300, q.render[0], '', true);
  message(2, 3, 364, q.push[0], q.push[1]);

  const note: Box = { x: columns[3] - 150, y: 384, w: 300, h: 66 };
  f.add(
    `<rect x="${note.x + 0.5}" y="${note.y + 0.5}" width="${note.w - 1}" height="${note.h - 1}" rx="8" fill="${t.accent}" fill-opacity="${t.accentWash}" stroke="${t.accent}" stroke-opacity="0.35"/>`
  );
  f.text(note.x + 16, note.y + 24, q.noteTag, T.tag, t.accent);
  wrap(q.note, T.small, note.w - 32).forEach((line, i) => {
    f.text(note.x + 16, note.y + 44 + i * 17, line, T.small, t.text);
  });

  message(2, 3, 498, q.pull[0], q.pull[1]);
  message(3, 2, 546, q.rows[0], '', true);
  message(2, 1, 600, q.merge[0], q.merge[1]);
  return f;
}

// ─── Output ─────────────────────────────────────────────────────────────────────────────────────

const FIGURES = { hero, numbers, pipeline, architecture, sync } as const;

const OUT = 'docs/assets';

if (import.meta.main) {
  const preview = Deno.args.includes('--preview');
  await resolveFonts();
  await Deno.mkdir(OUT, { recursive: true });

  for (const lang of Object.keys(STRINGS) as Lang[]) {
    setLocale(lang === 'tr' ? 'tr-TR' : 'en-US');
    for (const theme of THEMES) {
      for (const [name, draw] of Object.entries(FIGURES)) {
        const svg = draw(theme, STRINGS[lang]).svg();
        const file = `${OUT}/${name}-${lang}-${theme.name}`;
        await Deno.writeTextFile(`${file}.svg`, svg);
        if (preview) {
          await Deno.writeFile(`${file}.preview.png`, new Resvg(svg).render().asPng());
        }
        console.log(`${file}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
      }
    }
  }
  if (overflows.length > 0) {
    const unique = [...new Set(overflows)];
    console.error(`${unique.length} label(s) do not fit:`);
    for (const overflow of unique) console.error(`  ${overflow}`);
    Deno.exit(1);
  }
}
