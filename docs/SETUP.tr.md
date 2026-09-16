# Kurulum

Boş bir makineden çalışan uygulamaya ve yayına alınmış arka uca kadar tüm adımlar. İngilizcesi:
[`SETUP.md`](./SETUP.md).

## Gereksinimler

| Araç | Ne için |
| ---- | ------- |
| Node.js 22 | Uygulama, Jest ve veritabanı testleri |
| Docker | Veritabanı testleri ve migration'lardan tip üretimi |
| Bir Supabase projesi | Kimlik doğrulama, Postgres, Edge Functions |
| Bir OpenAI API anahtarı | Plan üretimi ve içerik denetimi (planı Gemini de yazabilir) |

Supabase CLI ve Deno `npx` ile çalışır; ayrıca kurulum gerekmez.

## 1. Uygulama

```bash
npm install
cp .env.example .env    # Supabase URL'sini ve anon anahtarını girin
npm start
```

E-posta ile giriş Expo Go'da çalışır. Google ile giriş için geliştirme derlemesi gerekir
(`npx expo run:android`), çünkü Expo Go bu yerel modülü içermez.

`.env` yoksa da uygulama açılır. Oturum kapalı başlar, giriş ekranı arka ucun yapılandırılmadığını
söyler ve görev bölme çevrimdışı adımlara döner.

## 2. Arka uç

```bash
npx supabase login
npx supabase link --project-ref <proje-ref>
npx supabase db push                       # supabase/migrations dosyalarını sırayla uygular
```

Fonksiyon gizli değerleri:

```bash
npx supabase secrets set HMAC_SECRET="$(openssl rand -hex 32)"
npx supabase secrets set OPENAI_API_KEY=sk-...
```

| Değer | Zorunlu | Anlamı |
| ----- | ------- | ------ |
| `HMAC_SECRET` | Evet | Saklanan her özetin anahtarı. Yoksa fonksiyon başlamaz. Değiştirilirse yalnızca eski satırlarla tekrar eşleştirme bozulur |
| `OPENAI_API_KEY` | Evet (`ALLOW_UNMODERATED=true` değilse) | OpenAI ile plan üretimi ve, planı hangi sağlayıcı yazarsa yazsın, içerik denetimi |
| `AI_PROVIDER` | Hayır | `openai` (varsayılan) veya `gemini` |
| `OPENAI_MODEL` | Hayır | Varsayılanı `gpt-4o-mini` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini ile | `GEMINI_MODEL` varsayılanı `gemini-2.0-flash` |
| `ALLOW_UNMODERATED` | Hayır | `true` ise istekler denetimsiz karşılanır. Bu değer yoksa OpenAI anahtarı olmayan kurulum `503 MOD_DOWN` döner |

`SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` platform tarafından sağlanır.

Fonksiyonları yayına alın:

```bash
npx supabase functions deploy break-task
npx supabase functions deploy delete-user
npx supabase functions deploy export-user-data
```

### Var olan bir projeyi 014 sonrasına taşımak

Migration 015, 014 öncesindeki `break-task` sürümlerinin hâlâ yazdığı sütunları kaldırır. İkisini
arada bir yayınla, sırayla uygulayın (genişlet, yayınla, daralt):

1. `014_atomic_rate_limits.sql` dosyasını uygulayın.
2. `break-task` fonksiyonunu yayına alın.
3. `015_harden_schema.sql` dosyasını uygulayın.

`supabase db push` ikisini birden uygular; bu yalnızca henüz çalışan bir fonksiyonu olmayan
projede güvenlidir. Ayrıntılı adımlar ve geri alma için:
[`RUNBOOK.md`](./RUNBOOK.md#deploying).

## 3. Giriş sağlayıcıları

E-posta ile giriş ek ayar istemez. Yerel sağlayıcılar uygulamaya bir kimlik jetonu verir; bu jeton
`supabase.auth.signInWithIdToken` ile oturuma çevrilir.

**Google**

1. Google Cloud'da **Web application** türünde bir OAuth istemcisi oluşturun. İstemci kimliğini
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` değişkenine yazın.
2. Uygulamanın paket adıyla (`app.json` içindeki `android.package`) ve imzalama anahtarının
   SHA-1 değeriyle bir **Android** OAuth istemcisi oluşturun. Hata ayıklama anahtarının değerini
   `npx expo run:android`, yayın anahtarınınkini EAS gösterir.
3. Supabase'de **Authentication → Providers → Google** bölümüne web istemci kimliğini ve sırrını
   girin. Web istemci kimliğini **Authorized Client IDs** alanına da ekleyin.

**Apple** (yalnızca iOS)

1. Apple Developer portalında uygulamanın paket kimliği için **Sign in with Apple** özelliğini
   açın.
2. Supabase'de **Authentication → Providers → Apple** bölümüne paket kimliğini istemci kimliği
   olarak ekleyin.
3. `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true` yapın.

## 4. Zamanlanmış işler

Saklama süresi ve kota temizliği düz SQL fonksiyonlarıdır. `pg_cron` eklentisi açıkken:

```sql
SELECT cron.schedule('cleanup-old-tasks', '0 3 * * *', 'SELECT public.cleanup_old_tasks();');
SELECT cron.schedule('cleanup-rate-limits', '17 * * * *', 'SELECT public.cleanup_rate_limits();');
```

## 5. Kurulumu doğrulama

```bash
# Anonim istek, yapay zekâ çalışmadan reddedilmeli: 401 beklenir.
# 503 fonksiyonun yayında ama yanlış yapılandırılmış olduğunu gösterir; gövde nedenini söyler.
curl -i -X POST "https://<proje-ref>.supabase.co/functions/v1/break-task" \
  -H "apikey: <anon-anahtar>" -H "Authorization: Bearer <anon-anahtar>" \
  -H "Content-Type: application/json" -d '{}'
```

Ardından uygulamada bir görev bölün ve
[`ops/telemetry-queries.sql`](./ops/telemetry-queries.sql) dosyasındaki 1. sorguyu çalıştırın.
İstek; istem sürümü, model, süre ve jeton sayısıyla orada görünmelidir.

## 6. Geliştirme kontrolleri

| Komut | Neyi denetler |
| ----- | ------------- |
| `npm run typecheck` | TypeScript, katı modda |
| `npm run lint` | ESLint, sıfır uyarıyla |
| `npm run format:check` | Prettier |
| `npm test` | Jest: depolar, API istemcisi, oturum depolama, çeviriler, arayüz mantığı |
| `npm run test:edge` | Deno: Edge Function işleyicisi, yapay zekâ hattı, sağlayıcılar, denetim |
| `npm run test:db` | Postgres: migration'lar, RLS, yetkiler, kota eş zamanlılığı, operasyon sorguları |
| `npm run gen:types` | `database.types.ts` dosyasını migration'lardan yeniden üretir (önce `test:db`) |
| `npm run eval:ai -- --dry-run` | Çevrimdışı değerlendirme düzeneği, sağlayıcı olmadan |

`test:db`, içinde veritabanı oluşturabileceği bir Postgres ister:

```bash
docker run -d --name minito-test-db -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:15-alpine
npm run test:db
```
