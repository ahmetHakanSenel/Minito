import { parse } from 'https://deno.land/std@0.168.0/flags/mod.ts';
import {
  type ChatMessage,
  type Complete,
  detectLanguage,
  PROMPT_VERSION,
  runBreakdownPipeline,
} from '../supabase/functions/break-task/pipeline.ts';
import {
  createMeter,
  DEFAULT_OPENAI_MODEL,
  REQUEST_BUDGET_MS,
  resolveProvider,
  withBudget,
} from '../supabase/functions/break-task/providers.ts';

/**
 * Offline evaluation for the break-task pipeline.
 *
 * Runs a fixed set of tasks through the real pipeline and reports the structural quality
 * metrics — schema pass rate, repair rate, fallback rate, language match, tokens, latency — so
 * prompt, model and parameter changes can be compared without waiting for production traffic.
 * A full run costs a few cents.
 *
 * What it cannot measure: tone, and whether the plan actually got someone started. Those need
 * real users (feedback_score) or a human reading the output.
 *
 *   deno run --allow-net --allow-env --allow-read --allow-write scripts/eval.ts --dry-run
 *   OPENAI_API_KEY=sk-... deno run --allow-net --allow-env --allow-read --allow-write scripts/eval.ts
 */

// Verify against the provider's current price list before trusting any cost number.
const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
};

type EvalTask = { id: string; language: 'tr' | 'en'; category: string; text: string };

type TaskResult = {
  id: string;
  category: string;
  expectedLanguage: string;
  source: string | 'unreachable';
  finishReason?: string;
  responseLanguage?: string;
  languageMatch?: boolean;
  stepCount?: number;
  firstStepDifficulty?: string;
  totalMinutes?: number;
  tokens: { total: number; prompt: number; completion: number; cached: number };
  aiLatencyMs: number;
  issues: string[];
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function rate(count: number, total: number): string {
  return total === 0 ? '—' : `${((count / total) * 100).toFixed(1)}%`;
}

/**
 * A provider that never calls the network: the first task is answered well, the second needs a
 * repair and the third cannot be repaired. It exercises all three pipeline outcomes so the
 * harness itself can be checked without spending anything.
 */
function dryRunProvider(): Complete {
  let call = 0;
  return (messages: ChatMessage[]) => {
    call += 1;
    const task = messages.at(-2)?.content ?? messages.at(-1)?.content ?? '';
    const language = detectLanguage(task);
    const plan = {
      language,
      empathy_bridge: 'This one has been sitting on your chest for a while.',
      first_step_hook: 'Stand up and stretch once.',
      steps: [1, 2, 3].map((n) => ({
        id: `step-${n}`,
        title: `Do the small thing number ${n}`,
        instruction: 'One concrete action, and you know it is done when you stop.',
        estimated_minutes: n + 1,
        difficulty: n === 1 ? 'easy' : 'medium',
      })),
      stopping_point: 'You can stop here, this already counts.',
    };

    if (call % 5 === 2) return Promise.resolve({ content: 'not json at all', tokenUsage: 120 });
    if (call % 7 === 3) {
      return Promise.resolve({ content: JSON.stringify({ oops: true }), tokenUsage: 90 });
    }
    return Promise.resolve({
      content: JSON.stringify(plan),
      tokenUsage: 1500,
      promptTokens: 1200,
      completionTokens: 300,
      cachedTokens: 0,
      finishReason: 'stop',
    });
  };
}

async function main(): Promise<void> {
  const flags = parse(Deno.args, {
    string: ['provider', 'model', 'tasks', 'out'],
    boolean: ['dry-run'],
    default: {
      provider: 'openai',
      tasks: 'docs/eval/tasks.json',
      out: 'docs/eval/results',
    },
  });

  const tasks: EvalTask[] = JSON.parse(await Deno.readTextFile(flags.tasks));
  const dryRun = flags['dry-run'] === true;

  const model =
    flags.model ||
    (flags.provider === 'gemini' ? Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash' : '') ||
    DEFAULT_OPENAI_MODEL;

  const adapter = dryRun
    ? null
    : resolveProvider(flags.provider, {
        openaiKey: Deno.env.get('OPENAI_API_KEY') || '',
        openaiModel: model,
        geminiKey: Deno.env.get('GEMINI_API_KEY') || '',
        geminiModel: model,
      });

  if (!dryRun && !adapter) {
    console.error(
      `No usable provider for "${flags.provider}". Set OPENAI_API_KEY or GEMINI_API_KEY, or pass --dry-run.`
    );
    Deno.exit(1);
  }

  const modelLabel = dryRun ? 'dry-run' : (adapter?.model ?? model);
  console.log(`Running ${tasks.length} tasks · prompt ${PROMPT_VERSION} · model ${modelLabel}\n`);

  const results: TaskResult[] = [];
  // One shared instance, so its counter advances across tasks and every outcome gets exercised.
  const dryComplete = dryRun ? dryRunProvider() : null;

  // Sequential on purpose: provider rate limits matter more here than wall-clock time.
  for (const task of tasks) {
    const meter = createMeter();
    const complete = dryComplete ?? withBudget(adapter!, Date.now() + REQUEST_BUDGET_MS, meter);

    const startedAt = performance.now();
    const outcome = await runBreakdownPipeline(complete, { task: task.text, displayName: null });
    const elapsed = Math.round(performance.now() - startedAt);

    if (!outcome) {
      results.push({
        id: task.id,
        category: task.category,
        expectedLanguage: task.language,
        source: 'unreachable',
        tokens: { total: 0, prompt: 0, completion: 0, cached: 0 },
        aiLatencyMs: dryRun ? elapsed : meter.aiLatencyMs,
        issues: ['provider unreachable'],
      });
      console.log(`  ${task.id.padEnd(16)} unreachable`);
      continue;
    }

    const { breakdown, source, tokens, finishReason, issues } = outcome;
    const responseLanguage = source === 'fallback' ? undefined : breakdown.language;
    results.push({
      id: task.id,
      category: task.category,
      expectedLanguage: task.language,
      source,
      finishReason,
      responseLanguage,
      languageMatch:
        responseLanguage === undefined ? undefined : responseLanguage === task.language,
      stepCount: breakdown.steps.length,
      firstStepDifficulty: breakdown.steps[0]?.difficulty,
      totalMinutes: breakdown.steps.reduce((sum, step) => sum + step.estimated_minutes, 0),
      tokens,
      aiLatencyMs: dryRun ? elapsed : meter.aiLatencyMs,
      issues,
    });

    console.log(
      `  ${task.id.padEnd(16)} ${source.padEnd(9)} ${String(breakdown.steps.length).padStart(2)} steps · ` +
        `${String(tokens.total).padStart(5)} tok · ${String(meter.aiLatencyMs || elapsed).padStart(5)} ms` +
        (issues.length > 0 ? `  ← ${issues[0]}` : '')
    );
  }

  const total = results.length;
  const by = (predicate: (r: TaskResult) => boolean) => results.filter(predicate).length;
  const latencies = results.map((r) => r.aiLatencyMs);
  const price = PRICES_USD_PER_MTOK[modelLabel];
  const promptTokens = results.reduce((sum, r) => sum + r.tokens.prompt, 0);
  const completionTokens = results.reduce((sum, r) => sum + r.tokens.completion, 0);
  const cost = price
    ? (promptTokens * price.input + completionTokens * price.output) / 1_000_000
    : null;

  const summary = {
    prompt_version: PROMPT_VERSION,
    model: modelLabel,
    provider: dryRun ? 'dry-run' : flags.provider,
    ran_at: new Date().toISOString(),
    tasks: total,
    first_try_pass_rate: rate(
      by((r) => r.source === 'model'),
      total
    ),
    repair_rate: rate(
      by((r) => r.source === 'repaired'),
      total
    ),
    fallback_rate: rate(
      by((r) => r.source === 'fallback'),
      total
    ),
    unreachable_rate: rate(
      by((r) => r.source === 'unreachable'),
      total
    ),
    language_match_rate: rate(
      by((r) => r.languageMatch === true),
      by((r) => r.languageMatch !== undefined)
    ),
    first_step_easy_rate: rate(
      by((r) => r.firstStepDifficulty === 'easy'),
      by((r) => r.firstStepDifficulty !== undefined)
    ),
    truncated_replies: by((r) => r.finishReason === 'length' || r.finishReason === 'MAX_TOKENS'),
    avg_total_tokens: Math.round(
      results.reduce((s, r) => s + r.tokens.total, 0) / Math.max(total, 1)
    ),
    cached_prompt_tokens: results.reduce((s, r) => s + r.tokens.cached, 0),
    p50_ai_latency_ms: percentile(latencies, 50),
    p95_ai_latency_ms: percentile(latencies, 95),
    estimated_cost_usd: cost === null ? null : Number(cost.toFixed(4)),
  };

  console.log('\n' + '─'.repeat(52));
  for (const [key, value] of Object.entries(summary)) {
    console.log(`  ${key.padEnd(24)} ${value}`);
  }
  console.log('─'.repeat(52));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `${flags.out}/${PROMPT_VERSION}_${modelLabel}_${stamp}.json`;
  await Deno.mkdir(flags.out, { recursive: true });
  await Deno.writeTextFile(file, JSON.stringify({ summary, results }, null, 2) + '\n');
  console.log(`\nWritten to ${file}`);
}

if (import.meta.main) {
  await main();
}
