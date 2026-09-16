/**
 * Database tests: every migration applied in order to a real Postgres, then the security and
 * concurrency guarantees the app relies on, checked from the roles a client actually gets.
 *
 *   docker run -d --name minito-test-db -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:15-alpine
 *   npm run test:db
 *
 * DATABASE_URL points at any Postgres the tests may create a database in (CI uses a service
 * container). Each run starts from an empty database.
 */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';

const ADMIN_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:54329/postgres';
const TEST_DATABASE = 'minito_migrations_test';
const SUPABASE_DIR = new URL('../', import.meta.url);
const REPO_DIR = new URL('../../', import.meta.url);

/** @type {pg.Pool} */
let pool;

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DATABASE} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DATABASE}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${TEST_DATABASE}`;
  pool = new pg.Pool({ connectionString: url.toString(), max: 64 });

  await pool.query(await readFile(new URL('tests/bootstrap.sql', SUPABASE_DIR), 'utf8'));
  const migrations = (await readdir(new URL('migrations/', SUPABASE_DIR)))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of migrations) {
    try {
      await pool.query(await readFile(new URL(`migrations/${file}`, SUPABASE_DIR), 'utf8'));
    } catch (error) {
      throw new Error(`${file} failed to apply: ${error.message}`);
    }
  }
});

after(async () => {
  await pool?.end();
});

// ─── Helpers ────────────────────────────────────────────────────────────────────────────────────

async function createUser() {
  const { rows } = await pool.query('INSERT INTO auth.users DEFAULT VALUES RETURNING id');
  return rows[0].id;
}

async function insertTask(userId, requestId) {
  await pool.query(
    `INSERT INTO public.tasks (user_id, request_id, input_hash, latency_ms)
     VALUES ($1, $2, 'hash', 100)`,
    [userId, requestId]
  );
}

/**
 * Runs `fn` inside a transaction as `role`, optionally as a signed-in user, then rolls back.
 * Postgres aborts a transaction at its first error, so a block should expect at most one.
 */
async function as(role, userId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`);
    if (userId) {
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
    }
    return await fn(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

/** One committed quota call as the service role, on its own connection. */
async function consumeQuota(identifier, max, windowInterval = '1 hour') {
  const client = await pool.connect();
  try {
    await client.query('SET ROLE service_role');
    const { rows } = await client.query(
      'SELECT public.check_and_consume_quota($1, $2, $3::interval) AS granted',
      [identifier, max, windowInterval]
    );
    return rows[0].granted;
  } finally {
    await client.query('RESET ROLE').catch(() => {});
    client.release();
  }
}

async function counter(identifier) {
  const { rows } = await pool.query(
    'SELECT request_count FROM public.rate_limits WHERE identifier = $1',
    [identifier]
  );
  return rows[0]?.request_count;
}

const PERMISSION_DENIED = { code: '42501' };
const INVALID_PARAMETER = { code: '22023' };
const UNIQUE_VIOLATION = { code: '23505' };

// ─── Quota ──────────────────────────────────────────────────────────────────────────────────────

describe('check_and_consume_quota', () => {
  test('grants up to the limit, then refuses without growing the counter', async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await consumeQuota('user:sequential', 3));

    assert.deepEqual(results, [true, true, true, false, false, false]);
    assert.equal(await counter('user:sequential'), 4);
  });

  test('an expired window starts again at one', async () => {
    for (let i = 0; i < 4; i++) await consumeQuota('user:window', 3);
    await pool.query(
      "UPDATE public.rate_limits SET window_start = NOW() - INTERVAL '2 hours' WHERE identifier = 'user:window'"
    );

    assert.equal(await consumeQuota('user:window', 3), true);
    assert.equal(await counter('user:window'), 1);
  });

  test('concurrent requests for a new identifier never exceed the limit', async () => {
    const results = await Promise.all(
      Array.from({ length: 60 }, () => consumeQuota('ip:burst-new', 20))
    );

    assert.equal(results.filter(Boolean).length, 20);
    assert.equal(await counter('ip:burst-new'), 21);
  });

  test('concurrent requests for an existing identifier never exceed the limit', async () => {
    await consumeQuota('ip:burst-existing', 20);
    const results = await Promise.all(
      Array.from({ length: 60 }, () => consumeQuota('ip:burst-existing', 20))
    );

    assert.equal(results.filter(Boolean).length, 19);
  });

  test('a lowered limit applies to a counter that is already past it', async () => {
    for (let i = 0; i < 10; i++) await consumeQuota('user:lowered', 50);
    assert.equal(await consumeQuota('user:lowered', 5), false);
    assert.equal(await counter('user:lowered'), 6);
  });

  test('rejects invalid arguments', async () => {
    for (const [identifier, max, windowInterval] of [
      ['', 3, '1 hour'],
      ['x'.repeat(129), 3, '1 hour'],
      ['user:x', 0, '1 hour'],
      ['user:x', 1_000_001, '1 hour'],
      ['user:x', 3, '0 seconds'],
      ['user:x', 3, '-1 hour'],
    ]) {
      await assert.rejects(consumeQuota(identifier, max, windowInterval), INVALID_PARAMETER);
    }
  });

  test('cleanup removes only windows older than the retention', async () => {
    await consumeQuota('user:stale', 3);
    await consumeQuota('user:fresh', 3);
    await pool.query(
      "UPDATE public.rate_limits SET window_start = NOW() - INTERVAL '3 days' WHERE identifier = 'user:stale'"
    );
    const deleted = await as('service_role', null, async (client) => {
      const { rows } = await client.query('SELECT public.cleanup_rate_limits() AS n');
      const { rows: left } = await client.query(
        "SELECT identifier FROM public.rate_limits WHERE identifier IN ('user:stale', 'user:fresh')"
      );
      return { n: rows[0].n, left: left.map((row) => row.identifier) };
    });

    assert.equal(deleted.n, 1);
    assert.deepEqual(deleted.left, ['user:fresh']);
  });

  test('clients can neither call it nor read the counters', async () => {
    const user = await createUser();
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(
        as(role, user, (client) =>
          client.query("SELECT public.check_and_consume_quota('user:victim', 1, '1 hour')")
        ),
        PERMISSION_DENIED
      );
      await assert.rejects(
        as(role, user, (client) => client.query('SELECT * FROM public.rate_limits')),
        PERMISSION_DENIED
      );
      await assert.rejects(
        as(role, user, (client) => client.query('SELECT public.cleanup_rate_limits()')),
        PERMISSION_DENIED
      );
    }
  });
});

// ─── Account deletion ───────────────────────────────────────────────────────────────────────────

describe('account deletion', () => {
  test('removes owned rows but keeps quota counters', async () => {
    const user = await createUser();
    await insertTask(user, `req-${user}`);
    await pool.query(
      "INSERT INTO public.task_breakdowns (user_id, title, steps) VALUES ($1, 'A task', '[]')",
      [user]
    );
    await consumeQuota(`user:${user}`, 20);

    await pool.query('DELETE FROM auth.users WHERE id = $1', [user]);

    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*) FROM public.tasks WHERE user_id = $1)::int AS tasks,
         (SELECT count(*) FROM public.task_breakdowns WHERE user_id = $1)::int AS breakdowns`,
      [user]
    );
    assert.deepEqual(rows[0], { tasks: 0, breakdowns: 0 });
    assert.equal(await counter(`user:${user}`), 1);
  });
});

// ─── Row Level Security ─────────────────────────────────────────────────────────────────────────

describe('task_breakdowns', () => {
  test('each user sees and changes only their own rows', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const { rows } = await pool.query(
      "INSERT INTO public.task_breakdowns (user_id, title, steps) VALUES ($1, 'Bob task', '[]') RETURNING id",
      [bob]
    );
    const bobsRow = rows[0].id;

    const view = await as('authenticated', alice, async (client) => {
      await client.query("INSERT INTO public.task_breakdowns (title, steps) VALUES ('Mine', '[]')");
      const visible = await client.query('SELECT user_id FROM public.task_breakdowns');
      const updated = await client.query(
        "UPDATE public.task_breakdowns SET title = 'hijacked' WHERE id = $1",
        [bobsRow]
      );
      const deleted = await client.query('DELETE FROM public.task_breakdowns WHERE id = $1', [
        bobsRow,
      ]);
      return {
        owners: visible.rows.map((row) => row.user_id),
        updated: updated.rowCount,
        deleted: deleted.rowCount,
      };
    });

    assert.deepEqual(view, { owners: [alice], updated: 0, deleted: 0 });
  });

  test('a row cannot be created on behalf of another user', async () => {
    const alice = await createUser();
    const bob = await createUser();
    await assert.rejects(
      as('authenticated', alice, (client) =>
        client.query(
          "INSERT INTO public.task_breakdowns (user_id, title, steps) VALUES ($1, 'x', '[]')",
          [bob]
        )
      ),
      PERMISSION_DENIED
    );
  });

  test('anonymous callers see nothing', async () => {
    const user = await createUser();
    await pool.query(
      "INSERT INTO public.task_breakdowns (user_id, title, steps) VALUES ($1, 'x', '[]')",
      [user]
    );
    const count = await as('anon', null, async (client) => {
      const { rows } = await client.query('SELECT count(*)::int AS n FROM public.task_breakdowns');
      return rows[0].n;
    });
    assert.equal(count, 0);
  });
});

describe('tasks (telemetry)', () => {
  test('is invisible and unwritable to clients', async () => {
    const user = await createUser();
    await insertTask(user, `req-visible-${user}`);

    const visible = await as('authenticated', user, async (client) => {
      const { rows } = await client.query('SELECT count(*)::int AS n FROM public.tasks');
      return rows[0].n;
    });
    assert.equal(visible, 0);

    await assert.rejects(
      as('authenticated', user, (client) =>
        client.query(
          "INSERT INTO public.tasks (user_id, input_hash, feedback_score) VALUES ($1, 'h', 'helpful')",
          [user]
        )
      ),
      PERMISSION_DENIED
    );
  });

  test('request ids are unique, so a retried insert cannot duplicate a row', async () => {
    const user = await createUser();
    await insertTask(user, `req-once-${user}`);
    await assert.rejects(insertTask(user, `req-once-${user}`), UNIQUE_VIOLATION);
  });

  test('personal data without a purpose is gone', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tasks'
         AND column_name IN ('client_ip_hash', 'guest_id')`
    );
    assert.deepEqual(rows, []);
  });
});

describe('submit_breakdown_feedback', () => {
  test('scores only the caller’s own row', async () => {
    const alice = await createUser();
    const bob = await createUser();
    await insertTask(alice, `fb-alice-${alice}`);
    await insertTask(bob, `fb-bob-${bob}`);

    const outcome = await as('authenticated', alice, async (client) => {
      const call = (requestId) =>
        client
          .query("SELECT public.submit_breakdown_feedback($1, 'too_large') AS ok", [requestId])
          .then(({ rows }) => rows[0].ok);
      const own = await call(`fb-alice-${alice}`);
      const foreign = await call(`fb-bob-${bob}`);
      const missing = await call('does-not-exist');
      const empty = await call('');
      return { own, foreign, missing, empty };
    });
    assert.deepEqual(outcome, { own: true, foreign: false, missing: false, empty: false });
  });

  test('persists a score when the caller commits', async () => {
    const alice = await createUser();
    await insertTask(alice, `fb-commit-${alice}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [alice]);
      await client.query("SELECT public.submit_breakdown_feedback($1, 'wrong_tone')", [
        `fb-commit-${alice}`,
      ]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const { rows } = await pool.query(
      'SELECT feedback_score, feedback_at IS NOT NULL AS stamped FROM public.tasks WHERE request_id = $1',
      [`fb-commit-${alice}`]
    );
    assert.deepEqual(rows[0], { feedback_score: 'wrong_tone', stamped: true });
  });

  test('rejects scores outside the vocabulary', async () => {
    const alice = await createUser();
    await assert.rejects(
      as('authenticated', alice, (client) =>
        client.query("SELECT public.submit_breakdown_feedback('any', 'amazing')")
      ),
      INVALID_PARAMETER
    );
  });

  test('is not callable anonymously', async () => {
    await assert.rejects(
      as('anon', null, (client) =>
        client.query("SELECT public.submit_breakdown_feedback('any', 'helpful')")
      ),
      PERMISSION_DENIED
    );
  });
});

describe('translations', () => {
  test('are readable by anyone and writable by no client', async () => {
    await pool.query(
      "INSERT INTO public.translations (key, language_code, value) VALUES ('t.key', 'en', 'Hello')"
    );
    const count = await as('anon', null, async (client) => {
      const { rows } = await client.query('SELECT count(*)::int AS n FROM public.translations');
      return rows[0].n;
    });
    assert.equal(count, 1);

    const user = await createUser();
    await assert.rejects(
      as('authenticated', user, (client) =>
        client.query(
          "INSERT INTO public.translations (key, language_code, value) VALUES ('t.key', 'tr', 'x')"
        )
      ),
      PERMISSION_DENIED
    );
  });
});

// ─── Schema-wide invariants ─────────────────────────────────────────────────────────────────────

describe('schema invariants', () => {
  test('every table in public has row level security enabled', async () => {
    const { rows } = await pool.query(
      `SELECT c.relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`
    );
    assert.deepEqual(rows, []);
  });

  test('every function in public pins its search_path', async () => {
    const { rows } = await pool.query(
      `SELECT p.proname FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND NOT EXISTS (
           SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) AS setting
           WHERE setting LIKE 'search_path=%'
         )`
    );
    assert.deepEqual(rows, []);
  });

  test('anon can execute no SECURITY DEFINER function', async () => {
    const { rows } = await pool.query(
      `SELECT p.proname FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prosecdef
         AND has_function_privilege('anon', p.oid, 'EXECUTE')`
    );
    assert.deepEqual(rows, []);
  });

  test('retired objects are gone', async () => {
    const { rows } = await pool.query(
      `SELECT to_regclass('public.system_prompts') AS prompts,
              to_regprocedure('public.upsert_translation(text, text, text, text)') AS upsert`
    );
    assert.deepEqual(rows[0], { prompts: null, upsert: null });
  });
});

// ─── Operations ─────────────────────────────────────────────────────────────────────────────────

describe('operational queries', () => {
  test('every query in the telemetry playbook runs against the current schema', async () => {
    const sql = await readFile(new URL('docs/ops/telemetry-queries.sql', REPO_DIR), 'utf8');
    const user = await createUser();
    await pool.query(
      `INSERT INTO public.tasks (
         user_id, request_id, input_hash, latency_ms, ai_latency_ms, token_usage,
         prompt_token_usage, completion_token_usage, cached_token_usage, ai_model,
         prompt_version, breakdown_source, finish_reason, response_language, language_match,
         validation_issues, feedback_score
       ) VALUES
         ($1, 'ops-1', 'h', 4200, 3900, 1500, 1200, 300, 0, 'gpt-4o-mini', 'v-test', 'model',
          'stop', 'en', true, NULL, 'helpful'),
         ($1, 'ops-2', 'h', 9100, 8800, 2900, 2400, 500, 1024, 'gpt-4o-mini', 'v-test', 'repaired',
          'stop', 'tr', true, '["steps.0.difficulty: the first step must be easy"]', 'too_large')`,
      [user]
    );
    await pool.query(
      `INSERT INTO public.tasks (user_id, request_id, input_hash, latency_ms, fallback_reason,
         ai_model, prompt_version)
       VALUES ($1, 'ops-3', 'h', 17000, 'AI_DOWN', 'gpt-4o-mini', 'v-test')`,
      [user]
    );

    await as('service_role', null, async (client) => {
      const results = await client.query(sql);
      assert.ok(Array.isArray(results) && results.length >= 5, 'expected several result sets');
      const versionReport = results[0].rows.find((row) => row.prompt_version === 'v-test');
      assert.equal(Number(versionReport.requests), 3);
    });
  });
});
