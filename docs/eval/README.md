# Offline evaluation

A fixed set of tasks, run through the real pipeline, so prompt and model changes can be compared
by measurement instead of impression. A full run costs a few cents and takes about a minute.

## Running

```bash
# No API key, no network: checks the harness itself and exercises all three outcomes
npm run eval:ai -- --dry-run

# A real run against the configured provider
OPENAI_API_KEY=sk-... npm run eval:ai

# Compare a model or a provider
OPENAI_API_KEY=sk-... npm run eval:ai -- --model gpt-4.1-mini
GEMINI_API_KEY=... npm run eval:ai -- --provider gemini --model gemini-2.0-flash
```

Each run prints a summary and writes `docs/eval/results/<prompt-version>_<model>_<timestamp>.json`.
Commit the results of real runs: they are the evidence behind a prompt or model decision.

## What the numbers mean

| Metric | Reading it |
| ------ | ---------- |
| `first_try_pass_rate` | How often the model honours the contract unaided. The headline quality number |
| `repair_rate` | How often one repair round-trip was needed. Every point here is latency and tokens |
| `fallback_rate` | How often both attempts failed and the user got a generic plan |
| `language_match_rate` | Did the model answer in the language of the task |
| `first_step_easy_rate` | Is step 1 actually an easy one, which is the whole product promise |
| `truncated_replies` | Replies that hit the output ceiling (`finish_reason: length`). Any of these means raising `MAX_OUTPUT_TOKENS` or shortening the contract |
| `cached_prompt_tokens` | Whether the provider is serving our static system prompt from its cache |
| `p50` / `p95_ai_latency_ms` | Model time only, excluding our own overhead. Nearest-rank percentiles; with 20 tasks, p95 is the 19th value |
| `max_ai_latency_ms` | The slowest task. A value above the 9 s call timeout means an attempt timed out and was retried |
| `estimated_cost_usd` | Rough, from a hardcoded price table. Verify prices before quoting them |

## Changing the task set

`tasks.json` holds 20 tasks: 10 Turkish, 10 English, across the categories the offline fallback
also covers, plus deliberately awkward ones (a single word, a vague feeling, a question rather
than a task). Keep the set stable — its value comes from comparability across runs. Adding tasks
is fine; rewriting existing ones invalidates older results.

## What this cannot tell you

Structural quality only. Whether the plan sounds human, and whether it actually got someone
started, needs real users (`feedback_score`) or a person reading the output. For a tone change,
read ten outputs by hand before trusting the rates.

## Baseline

`results/task-breakdown-v2_gpt-4o-mini_*.json` is the current baseline: 20/20 valid on the first
try, every answer in the right language, p50 3.5 s and p95 6.5 s model time. The slowest task
(`tr-finance-1`, 11.9 s) had its first call time out at 9 s and succeed on the retry.

That file's summary was recomputed from its own per-task results after a percentile bug was fixed:
the harness used to report the sample maximum as p95.
