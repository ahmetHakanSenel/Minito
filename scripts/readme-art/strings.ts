/**
 * Every word in the README figures, per language. Pairs are [title, detail].
 * Numbers mirror the test suites and the evaluation baseline; update them together.
 */

type Pair = [string, string];

export type Strings = {
  hero: {
    alt: string;
    kicker: string;
    line1: string;
    /** Segments of the second line; `true` marks the accented part. */
    line2: [string, boolean][];
    body: string;
    stack: string[];
    cardTag: string;
    cardMeta: string;
    task: string;
    startHere: string;
    firstAction: string;
    steps: [string, string, boolean][];
    footer: string;
  };
  // Grouped, because a number means nothing without knowing where it came from: a figure that
  // puts a measured test count next to a design target invites the reader to take both as
  // production fact.
  numbers: {
    alt: string;
    groups: { caption: string; items: [string, string, string][] }[];
  };
  pipeline: {
    alt: string;
    tag: string;
    heading: string;
    gate: Pair;
    guard: Pair;
    fence: Pair;
    generate: Pair;
    validate: Pair;
    planModel: Pair;
    errors: Pair;
    repair: Pair;
    planRepaired: Pair;
    fallback: Pair;
    valid: string;
    invalid: string;
    stillInvalid: string;
    rejected: string;
    limited: string;
    afterTag: string;
    afterTitle: string;
    afterBody: string;
  };
  architecture: {
    alt: string;
    tag: string;
    heading: string;
    device: string;
    cloud: string;
    vendors: string;
    screens: Pair;
    controllers: Pair;
    sync: Pair;
    repositories: Pair;
    local: Pair;
    session: Pair;
    auth: Pair;
    breakTask: Pair;
    postgres: [string, string, string];
    cron: Pair;
    ops: Pair;
    moderation: Pair;
    model: Pair;
    webhook: Pair;
    https: string;
    rest: string;
    syncEdge: string;
    verify: string;
    quota: string;
    snapshot: string;
    moderate: string;
    generate: string;
    optional: string;
  };
  sync: {
    alt: string;
    tag: string;
    heading: string;
    participants: Pair[];
    edit: Pair;
    render: Pair;
    push: Pair;
    noteTag: string;
    note: string;
    pull: Pair;
    rows: Pair;
    merge: Pair;
  };
};

const en: Strings = {
  hero: {
    alt: 'Minito: turn an overwhelming task into a first step you can take',
    kicker: 'ADHD-friendly task starter',
    line1: 'Turn an overwhelming task',
    line2: [
      ['into a ', false],
      ['first step', true],
      [' you can take.', false],
    ],
    body: 'A React Native app on Supabase. Its AI pipeline is contract-checked, rate-limited atomically and observable end to end, and the planner keeps working offline.',
    stack: ['Expo SDK 57', 'Supabase', 'Postgres', 'Deno', 'OpenAI'],
    cardTag: 'Plan',
    cardMeta: '3 steps · 12 min',
    task: 'Clean the kitchen before Sunday',
    startHere: 'Start here',
    firstAction: 'Stand in the doorway and take one slow breath.',
    steps: [
      ['Carry three cups to the sink', '2 min', true],
      ['Wipe the counter next to the sink', '4 min', true],
      ['Load the dishwasher halfway', '6 min', false],
    ],
    footer: 'model · task-breakdown-v2 · 3.5 s · 1,381 tokens',
  },
  numbers: {
    alt: 'Verified in CI: 280 automated tests across 3 suites; 20 of 60 parallel calls granted under a quota of 20; 25 threats modeled, each tied to a test; zero lint warnings. Offline AI baseline over 20 tasks: 20 of 20 valid on the first try and in the right language; 6.5 s p95 model latency, 3.5 s p50',
    groups: [
      {
        caption: 'Verified in CI',
        items: [
          ['280', 'automated tests', '3 suites, every push'],
          ['20 / 60', 'parallel calls granted', 'quota of 20, never more'],
          ['25', 'threats modeled', 'each tied to a test'],
          ['0', 'lint warnings', 'enforced in CI'],
        ],
      },
      {
        caption: 'Offline AI baseline · 20 tasks',
        items: [
          ['20 / 20', 'valid on first try', 'and language-matched'],
          ['6.5 s', 'p95 model latency', 'p50 3.5 s'],
        ],
      },
    ],
  },
  pipeline: {
    alt: 'The break-task request path: checks, moderation and quota, fenced prompt, generation, validation, one repair, and a deterministic fallback',
    tag: 'break-task · request path',
    heading: 'Every path ends in a valid plan or a defined error.',
    gate: ['Request checks', 'ready · JWT · body'],
    guard: ['Moderation + quota', 'parallel · fail open'],
    fence: ['Fenced prompt', 'v2 · input is data'],
    generate: ['Generate', 'JSON mode · 9 s/call'],
    validate: ['Validate', 'zod contract'],
    planModel: ['Plan', 'source: model'],
    errors: ['Defined error', '401 · 429 · 503'],
    repair: ['Repair, once', 'carries the issues'],
    planRepaired: ['Plan', 'source: repaired'],
    fallback: ['Fallback plan', 'deterministic'],
    valid: 'valid',
    invalid: 'invalid',
    stillInvalid: 'still invalid',
    rejected: 'rejected',
    limited: 'over quota',
    afterTag: 'After the reply',
    afterTitle: 'One telemetry row per request',
    afterBody:
      'Model, prompt version, latencies, token split and the rule that broke. It feeds the SLOs, the error budget and the alerts.',
  },
  architecture: {
    alt: 'System architecture: the Expo app, Supabase, and the AI providers',
    tag: 'Architecture',
    heading: 'A mobile app, a hardened Supabase backend, and model providers behind it.',
    device: 'Device · Expo / React Native',
    cloud: 'Supabase',
    vendors: 'Providers',
    screens: ['Screens', 'expo-router · guarded stack'],
    controllers: ['Controllers', 'auth · tasks · planner · health'],
    sync: ['Sync engine', 'queue · backoff'],
    repositories: ['Repositories', 'typed errors'],
    local: ['Local state', 'per account'],
    session: ['Session', 'AEAD · Keystore'],
    auth: ['Auth', 'email · Google'],
    breakTask: ['break-task', 'Edge Function · Deno · handler + pipeline'],
    postgres: [
      'Postgres',
      'RLS on every table · pinned search_path',
      'rate_limits · tasks · task_breakdowns · planner_*',
    ],
    cron: ['pg_cron', 'every 15 min'],
    ops: ['ops-alerts', 'SLO rules'],
    moderation: ['OpenAI moderation', 'omni-moderation'],
    model: ['Model', 'gpt-4o-mini · Gemini'],
    webhook: ['Webhook', 'Discord · Slack'],
    https: 'HTTPS · JWT',
    rest: 'REST · RLS',
    syncEdge: 'upsert · pull',
    verify: 'verify JWT',
    quota: 'quota · telemetry',
    snapshot: 'snapshot',
    moderate: '3 s',
    generate: '9 s',
    optional: 'optional',
  },
  sync: {
    alt: 'Offline-first planner sync: local edits, pushed rows, a server-side guard, and an overlapping pull',
    tag: 'Planner · offline-first sync',
    heading: 'Edits land on the device first. The server decides what is newer.',
    participants: [
      ['Planner screen', 'renders local state'],
      ['Device state', 'per account · on disk'],
      ['Sync engine', 'push · pull · backoff'],
      ['Postgres', 'RLS · trigger · tombstones'],
    ],
    edit: ['Edit', 'instant, offline too'],
    render: ['Re-render', ''],
    push: ['Upsert pending rows', 'projects first · 100 per batch'],
    noteTag: 'Server guard',
    note: 'Skips writes older than the stored row, clamps device clocks, stamps updated_at.',
    pull: ['Pull changes since the cursor', 'with 60 s of overlap'],
    rows: ['Rows and tombstones', ''],
    merge: ['Merge', 'pending local edits win'],
  },
};

const tr: Strings = {
  hero: {
    alt: 'Minito: bunaltan bir görevi atabileceğin ilk adıma dönüştürür',
    kicker: 'DEHB dostu başlama aracı',
    line1: 'Bunaltan bir görevi',
    line2: [
      ['atabileceğin ', false],
      ['ilk adıma', true],
      [' çevir.', false],
    ],
    body: 'Supabase üzerinde bir React Native uygulaması. Yapay zekâ hattı sözleşmeyle denetlenir, kotası atomik olarak uygulanır ve baştan sona gözlemlenir; planlayıcı çevrimdışı da çalışır.',
    stack: ['Expo SDK 57', 'Supabase', 'Postgres', 'Deno', 'OpenAI'],
    cardTag: 'Plan',
    cardMeta: '3 adım · 12 dk',
    task: 'Pazara kadar mutfağı toparla',
    startHere: 'Buradan başla',
    firstAction: 'Kapının eşiğinde dur ve yavaşça bir nefes al.',
    steps: [
      ['Üç fincanı lavaboya taşı', '2 dk', true],
      ['Lavabonun yanındaki tezgâhı sil', '4 dk', true],
      ['Bulaşık makinesini yarıya kadar doldur', '6 dk', false],
    ],
    footer: 'model · task-breakdown-v2 · 3,5 sn · 1.381 jeton',
  },
  numbers: {
    alt: "CI'da doğrulanmış: 3 pakette 280 otomatik test; 20 kotasında 60 paralel çağrıdan 20'si kabul; her biri bir teste bağlı 25 modellenmiş tehdit; sıfır lint uyarısı. 20 görevlik çevrimdışı yapay zekâ ölçümü: 20 görevin 20'si ilk denemede ve doğru dilde geçerli; 6,5 sn p95 model gecikmesi, 3,5 sn p50",
    groups: [
      {
        caption: "CI'da doğrulanmış",
        items: [
          ['280', 'otomatik test', '3 paket, her push'],
          ['20 / 60', 'kabul edilen çağrı', 'kota 20, fazlası yok'],
          ['25', 'modellenmiş tehdit', 'her biri teste bağlı'],
          ['0', 'lint uyarısı', "CI'da zorunlu"],
        ],
      },
      {
        caption: 'Çevrimdışı yapay zekâ ölçümü · 20 görev',
        items: [
          ['20 / 20', 'ilk denemede geçerli', 've doğru dilde'],
          ['6,5 sn', 'p95 model gecikmesi', 'p50 3,5 sn'],
        ],
      },
    ],
  },
  pipeline: {
    alt: 'break-task istek yolu: kontroller, denetim ve kota, çitli istem, üretim, doğrulama, tek onarım ve deterministik yedek',
    tag: 'break-task · istek yolu',
    heading: 'Her yol, geçerli bir planla ya da tanımlı bir hatayla biter.',
    gate: ['İstek kontrolleri', 'hazır · JWT · gövde'],
    guard: ['Denetim + kota', 'paralel · açık kalır'],
    fence: ['Çitli istem', 'v2 · girdi = veri'],
    generate: ['Üretim', 'JSON modu · 9 sn'],
    validate: ['Doğrulama', 'zod sözleşmesi'],
    planModel: ['Plan', 'kaynak: model'],
    errors: ['Tanımlı hata', '401 · 429 · 503'],
    repair: ['Tek onarım', 'sorunları taşır'],
    planRepaired: ['Plan', 'kaynak: onarım'],
    fallback: ['Yedek plan', 'deterministik'],
    valid: 'geçerli',
    invalid: 'geçersiz',
    stillInvalid: 'hâlâ geçersiz',
    rejected: 'reddedildi',
    limited: 'kota aşıldı',
    afterTag: 'Yanıttan sonra',
    afterTitle: 'İstek başına bir telemetri satırı',
    afterBody:
      'Model, istem sürümü, gecikmeler, jeton dağılımı ve bozulan kural. SLO’ları, hata bütçesini ve uyarıları besler.',
  },
  architecture: {
    alt: 'Sistem mimarisi: Expo uygulaması, Supabase ve yapay zekâ sağlayıcıları',
    tag: 'Mimari',
    heading: 'Bir mobil uygulama, sağlamlaştırılmış bir Supabase arka ucu ve sağlayıcılar.',
    device: 'Cihaz · Expo / React Native',
    cloud: 'Supabase',
    vendors: 'Sağlayıcılar',
    screens: ['Ekranlar', 'expo-router · korumalı yığın'],
    controllers: ['Denetleyiciler', 'oturum · görev · planlayıcı · sağlık'],
    sync: ['Senkronizasyon', 'kuyruk · bekleme'],
    repositories: ['Depolar', 'tipli hatalar'],
    local: ['Yerel durum', 'hesap başına'],
    session: ['Oturum', 'AEAD · Keystore'],
    auth: ['Auth', 'e-posta · Google'],
    breakTask: ['break-task', 'Edge Function · Deno · işleyici + hat'],
    postgres: [
      'Postgres',
      'her tabloda RLS · sabit search_path',
      'rate_limits · tasks · task_breakdowns · planner_*',
    ],
    cron: ['pg_cron', '15 dakikada bir'],
    ops: ['ops-alerts', 'SLO kuralları'],
    moderation: ['OpenAI denetimi', 'omni-moderation'],
    model: ['Model', 'gpt-4o-mini · Gemini'],
    webhook: ['Webhook', 'Discord · Slack'],
    https: 'HTTPS · JWT',
    rest: 'REST · RLS',
    syncEdge: 'gönder · çek',
    verify: 'JWT doğrula',
    quota: 'kota · telemetri',
    snapshot: 'anlık görüntü',
    moderate: '3 sn',
    generate: '9 sn',
    optional: 'opsiyonel',
  },
  sync: {
    alt: 'Çevrimdışı öncelikli planlayıcı senkronizasyonu: yerel düzenleme, gönderilen satırlar, sunucu koruması ve örtüşen çekme',
    tag: 'Planlayıcı · çevrimdışı öncelikli',
    heading: 'Düzenleme önce cihaza yazılır. Hangisinin yeni olduğuna sunucu karar verir.',
    participants: [
      ['Planlayıcı ekranı', 'yerel durumu çizer'],
      ['Cihaz durumu', 'hesap başına · diskte'],
      ['Senkronizasyon', 'gönder · çek · bekle'],
      ['Postgres', 'RLS · tetikleyici · işaret'],
    ],
    edit: ['Düzenle', 'anında, çevrimdışı da'],
    render: ['Yeniden çiz', ''],
    push: ['Bekleyen satırları gönder', 'önce projeler · 100’lük grup'],
    noteTag: 'Sunucu koruması',
    note: 'Kayıtlı satırdan eski yazmaları atlar, cihaz saatini sınırlar, updated_at yazar.',
    pull: ['İmleçten sonrasını çek', '60 sn örtüşmeyle'],
    rows: ['Satırlar ve silme işaretleri', ''],
    merge: ['Birleştir', 'bekleyen yerel düzenleme kazanır'],
  },
};

export const STRINGS = { en, tr } as const;
export type Lang = keyof typeof STRINGS;
