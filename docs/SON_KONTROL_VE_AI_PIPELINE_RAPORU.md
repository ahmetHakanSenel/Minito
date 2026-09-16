# Minito — Güncel Kontrol ve AI Pipeline Raporu

## Genel sonuç

Son değişiklikler yalnızca README seviyesinde kalmamış; AI pipeline’ı gerçekten ayrıştırılmış, test edilebilir ve ölçülebilir hale getirilmiş.

Mevcut tablo:

- `67b9bab`: Structured AI output, validation ve repair loop
- `d55d938`: `stopping_point` alanının task history’ye eklenmesi
- Çalışma ağacında henüz commit edilmemiş AI telemetry, feedback ve provider değişiklikleri
- CI tanımı mevcut
- Deno testleri ve Jest testleri eklenmiş
- README, mevcut mimariyi büyük ölçüde doğru anlatıyor

Ancak iki önemli nokta var:

1. Çalışma dizini temiz değil.
2. README’de birkaç küçük fakat gerçek tutarsızlık ve birkaç teknik risk kaldı.

---

## 1. Yapılan değişikliklerin değerlendirmesi

### AI pipeline artık production-grade bir yapıya yaklaşıyor

`supabase/functions/break-task/pipeline.ts` içindeki akış artık net:

```text
Generate
→ JSON parse
→ Zod validation
→ tek repair
→ deterministic fallback
```

Güçlü kararlar:

- `PROMPT_VERSION` ile prompt versiyonlama
- Katmanlı prompt:
  - identity
  - rules
  - tone
  - decomposition
  - output contract
- Fenced user input
- Fence tag injection temizleme
- `TaskBreakdownSchema`
- Duplicate step ID kontrolü
- Tek repair isteği
- Fallback’ın module-load sırasında validate edilmesi
- Pipeline’ın HTTP ve storage katmanından ayrılması
- Deno unit testleri

Bu yaklaşım README’deki AI iddialarını kaynak kodda destekliyor.

### Provider ayrımı doğru yönde

`supabase/functions/break-task/providers.ts` içinde:

- OpenAI adapter
- Gemini adapter
- Ortak `ProviderAdapter`
- Timeout
- Retry
- Paylaşılan request budget
- Model latency ölçümü
- Provider-specific JSON mode

ayrıştırılmış durumda.

Bu, OpenAI ve Gemini branch’lerinin ana HTTP handler içinde büyümesini engelliyor.

Özellikle aşağıdaki yapı doğru:

```ts
withBudget(provider, startTime + REQUEST_BUDGET_MS, meter)
```

Böylece ilk istek, transport retry ve repair isteği tek bir toplam zaman bütçesi altında çalışıyor.

### Telemetri ve feedback döngüsü iyi tasarlanmış

`012_ai_telemetry_feedback.sql` migration’ı şu alanları ekliyor:

- `ai_model`
- `prompt_version`
- `ai_latency_ms`
- `breakdown_source`
- `feedback_score`
- `feedback_at`

Feedback’in client tarafından doğrudan `tasks` tablosuna yazılamaması ve bunun yerine:

```sql
submit_breakdown_feedback(...)
```

SECURITY DEFINER function’ı ile yapılması doğru bir güvenlik kararıdır.

Function:

- Yalnızca izin verilen score değerlerini kabul ediyor.
- `request_id` ile eşleştiriyor.
- `auth.uid()` ile sahiplik kontrolü yapıyor.
- `tasks` tablosunu client’a kapalı bırakıyor.

### UI entegrasyonu düşünülmüş

`BreakdownFeedback` bileşeni:

- Yalnızca `requestId` varsa gösteriliyor.
- Offline ve fallback akışlarında gereksiz feedback istemiyor.
- Kullanıcıyı retry ile yormuyor.
- Teşekkür mesajını anında gösteriyor.
- Telemetry hatasını kullanıcı deneyimine yansıtmıyor.

`stopping_point` ise şu zincirde taşınmış durumda:

```text
Edge Function response
→ client normalization
→ task repository
→ active session
→ focus screen
→ database history
```

Bu, uçtan uca veri bütünlüğü açısından önemli bir iyileştirme.

---

## 2. Çalışma dizini durumu

Çalışma dizini temiz değil. `d55d938` sonrasında aşağıdaki değişiklikler henüz commit edilmemiş görünüyor:

- `README.md`
- `app/focus.tsx`
- `app/index.tsx`
- `app/success.tsx`
- `src/data/supabase/database.types.ts`
- `src/lib/api/breakTask.ts`
- `src/lib/requestTracing.ts`
- `src/repositories/taskRepository.ts`
- `supabase/functions/break-task/index.ts`
- Provider ve feedback dosyaları
- İlgili testler
- `supabase/migrations/012_ai_telemetry_feedback.sql`

Ayrıca `git diff --check` şu uyarıyı verdi:

```text
supabase/README.md: trailing whitespace.
```

Bu satırlar Markdown hard-break amacıyla bilinçli bırakılmış olabilir; ancak commit öncesinde temizlenip format kontrolü yeniden çalıştırılmalı.

---

## 3. Tespit edilen teknik riskler

### P0 — AI_DOWN akışında request ID ile feedback ilişkisi riski

`breakTask.ts` içinde request ID istemci tarafında üretiliyor:

```ts
const requestId = safeRequestId();
```

Edge Function ise kendi kullandığı değeri şu şekilde belirliyor:

```ts
const requestId = traceId(req, request_id);
```

Çoğu durumda bu değer aynı olacaktır. Ancak şu senaryolarda farklılaşabilir:

- Request body’de `request_id` yoksa
- `safeRequestId()` başarısız olursa
- Server tarafındaki `traceId()` normalization uygularsa
- Gateway veya interceptor başka bir header request ID üretirse

Feedback’in kesin olarak analytics satırına bağlanması için server’ın kullandığı gerçek request ID response metadata’ya eklenmeli.

Önerilen response:

```ts
meta: {
  prompt_version: PROMPT_VERSION,
  source,
  request_id: requestId,
}
```

Client tarafı:

```ts
requestId: data.meta?.request_id ?? requestId
```

### P1 — Telemetry persistence başarısız olsa bile başarı response’u dönüyor

Başarılı AI çıktısında persistence üç kez deneniyor. Ancak üç deneme de başarısız olursa Edge Function yine başarılı breakdown response’u döndürüyor.

Bu kullanıcı deneyimi açısından makul olabilir; çünkü history veya telemetry hatası kullanıcı akışını bloklamamalı. Ancak README’deki “her request bir row yazar” iddiası bu durumda kesin değildir.

İki seçenek var:

#### Seçenek A — README ifadesini yumuşatmak

```text
Each request attempts to write one telemetry row.
Persistence is best-effort and never blocks the user response.
```

#### Seçenek B — Response metadata’ya persistence durumu eklemek

```ts
meta: {
  prompt_version: PROMPT_VERSION,
  source,
  telemetry_persisted: boolean,
}
```

Öneri: README ifadesini yumuşatın ve persistence başarısızlığını Sentry’ye warning olarak gönderin.

### P1 — Rate limit atomik değil

Mevcut yapı önce sayım yapıyor, sonra AI isteğine devam ediyor. Eşzamanlı isteklerde birden fazla çağrı aynı anda limiti geçebilir.

Daha sağlam çözüm:

```sql
consume_breakdown_quota(
  p_user_id uuid,
  p_ip_hash text,
  p_now timestamptz
)
```

Bu RPC:

- Transaction içinde sayım yapmalı.
- Limit uygunsa atomik kullanım kaydı oluşturmalı.
- `{ allowed, reason }` sonucu döndürmeli.

Şimdilik bu davranış README’de “count-based, best-effort rate limit” olarak açıkça yazılabilir.

### P1 — Prompt ile schema arasında atomicity farkı

Prompt içinde:

```text
instruction: one or two sentences
```

deniyor. Schema ise yalnızca karakter sınırı koyuyor:

```ts
instruction: z.string().trim().min(1).max(280)
```

Bu, tek instruction içinde birden çok eyleme izin verebilir.

Ek quality validation önerileri:

- `ve` / `and` yoğunluğu
- Birden fazla emir fiili
- Tekrarlanan adımlar
- Step 1’in 1–2 dakika aralığında olması
- İlk adımın `hard` olmaması
- Difficulty’nin kademeli artması

Bu kontroller başarısız olursa issue listesine eklenip repair prompt’a gönderilebilir.

### P1 — `difficulty: hard` ürün davranışıyla çelişebilir

Schema şu değerleri kabul ediyor:

```ts
'easy' | 'medium' | 'hard'
```

Minito’nun ana vaadi her adımı mikro ve başlatılabilir tutmak olduğu için `hard` bazı görevlerde kullanıcıyı yeniden kilitleyebilir.

İki seçenek:

1. Schema’yı `easy | medium` ile sınırlamak.
2. `hard` kalacaksa şu kuralı eklemek:

```text
A hard step must never exceed 10 minutes and must be preceded by at least two easy steps.
```

### P1 — Instruction uzunluk sınırı README ve kodda farklı

README’de instruction için 140 karakter yazıyor. `pipeline.ts` içinde ise 280 karakter kullanılıyor.

Prompt output contract’te de 280 karakter yazıyor.

Tek bir değer belirlenmeli. Mobil odak deneyimi için öneri:

```ts
max(180)
```

Ardından prompt ve README aynı değere getirilmeli.

### P1 — README’de localization key sayısı tutarsız

README’nin bir bölümünde:

```text
253 keys at parity
```

başka bir bölümünde:

```text
243 keys
```

yazıyor.

Tek bir doğrulanmış sayı kullanılmalı veya sayı yerine yalnızca “full key parity” denmeli.

---

## 4. AI pipeline kalite değerlendirmesi

### Güçlü noktalar

#### Structured output uygulanmış

OpenAI:

```ts
response_format: { type: 'json_object' }
```

Gemini:

```ts
responseMimeType: 'application/json'
```

Bu, serbest metin parse yükünü azaltıyor.

#### Repair döngüsü kontrollü

- İlk üretim için transport retry var.
- Invalid response için yalnızca bir repair var.
- Repair için transport retry yok.
- İkinci başarısızlıkta deterministic fallback çalışıyor.

Bu, latency ve maliyet kontrolü açısından mantıklı.

#### Fallback aynı schema’ya bağlı

Fallback planlarının module-load sırasında:

```ts
TaskBreakdownSchema.parse(...)
```

ile doğrulanması güçlü bir karar. Fallback bozulursa deploy/test aşamasında fark edilir.

#### Input fence güvenliği düşünülmüş

`buildUserPrompt()` içinde fence tag’lerin input’tan temizlenmesi, kullanıcının kendi değerini kapatıp prompt sınırını bozmasını engelliyor.

---

## 5. AI tarafında önerilen iyileştirmeler

### 5.1. Schema validation ile quality validation’ı ayırın

Schema validation şu soruları cevaplar:

- JSON geçerli mi?
- Alanlar var mı?
- Türler doğru mu?
- Uzunluklar uygun mu?

Ürün kalitesi için ayrıca şu sorulara ihtiyaç var:

- Step gerçekten atomic mi?
- İlk adım yeterince küçük mü?
- Adımlar birbirini tekrar ediyor mu?
- Görevle ilgili mi?
- Dil doğru mu?
- Adımlar kademeli mi ilerliyor?

Önerilen issue modeli:

```ts
type ValidationLayer = 'schema' | 'quality' | 'safety';

type ValidationIssue = {
  layer: ValidationLayer;
  code: string;
  path?: string;
  message: string;
};
```

### 5.2. Language detection fallback’ini sınırlı sorumlulukta tutun

Şu anki Türkçe tespit regex’i pratik bir fallback’tir, ancak kısa veya Türkçe karakter içermeyen cümlelerde yanılabilir.

Öneri:

- Model çıktısındaki `language` alanına öncelik verin.
- Input dil tespitini yalnızca deterministic fallback için kullanın.
- Türkçe ve İngilizce fallback testlerini genişletin.

### 5.3. Temperature değerini ölçerek optimize edin

Şu an `temperature: 0.7` kullanılıyor. Task decomposition için daha düşük varyans genellikle daha faydalıdır.

Test edilebilecek aralık:

```text
0.3 — 0.5
```

Karar şu metriklerle verilmelidir:

- Schema pass rate
- Repair rate
- İlk adım tamamlama oranı
- Feedback score
- Latency
- Token usage

### 5.4. Model language bilgisini telemetry’ye ekleyin

Response içinde `language` alanı mevcut; ancak client bunu state’e taşımıyor.

Raw task saklamadan şu metadata’lar ölçülebilir:

```ts
requested_locale
model_language
language_match
```

### 5.5. Token usage ile gerçek maliyeti ayırın

OpenAI ve Gemini token metrikleri birebir aynı maliyet anlamına gelmeyebilir.

`token_usage` alanı şu şekilde tanımlanmalı:

```text
provider-reported token count
```

Gerçek maliyet için ayrıca model/provider bazlı fiyatlandırma tablosundan:

```ts
estimated_cost_usd
```

hesaplanabilir.

---

## 6. Eksik test önerileri

Mevcut testler iyi bir başlangıç sağlıyor:

- Valid first response
- Repair
- Failed repair
- Provider unreachable
- Fallback language
- Fenced JSON
- Input fence injection
- Layer ordering
- Provider adapter testleri
- Feedback repository testleri
- Step normalization testleri

Eklenmesi önerilen testler:

### Pipeline

- Display name fence injection
- Task içinde Unicode/control character
- Duplicate instruction but unique ID
- Step 1 difficulty `hard`
- Invalid language
- Too-long empathy text
- Missing `stopping_point`
- Provider timeout
- Retryable 500
- Non-retryable 400
- Request budget exhaustion

### Client API

- `meta.source = repaired`
- Server fallback response
- Malformed structured response
- Missing `request_id`
- `401` signed-out state
- `429` rate limit
- `503` AI down
- Request ID body/header consistency

### Feedback

- Duplicate feedback submission
- Missing request ID hides component
- RPC returns false
- RPC unavailable
- Feedback translation keys exist in TR/EN

### Database

- Feedback function cannot score another user’s row
- Invalid score rejected
- Anonymous execution rejected
- `tasks` remains unreadable through anon key

---

## 7. CI değerlendirmesi

CI workflow genel olarak güçlü:

- Node 20
- `npm ci`
- Typecheck
- Lint
- Format check
- Jest
- Deno check
- Deno tests
- Full-history gitleaks scan
- Concurrency cancellation
- Read-only permissions

Bu, portföy için güçlü bir mühendislik sinyalidir.

### CI öncesi dikkat edilmesi gerekenler

`git diff --check` şu an `supabase/README.md` üzerinde trailing whitespace gösteriyor. Markdown hard-break amacıyla bilinçli bırakılmış olsa bile:

```bash
npm run format:check
```

gerçek çalışma ağacı üzerinde mutlaka çalıştırılmalı.

Secret scan’in yeşil olması, eski secret’ların hâlâ geçerli olamayacağı anlamına gelmez. Daha önce sızmış anahtarlar kullanıldıysa ayrıca:

- Revoke
- Rotate
- Supabase service role key yenileme
- OpenAI/Gemini key yenileme
- OAuth secret kontrolü

yapılmalı.

---

## 8. README doğruluk raporu

README büyük ölçüde kodla uyumlu. Şu iddialar kaynak kod tarafından destekleniyor:

- Structured AI output
- Zod validation
- Single repair
- Deterministic fallback
- Prompt version
- Model latency
- Feedback RPC
- RLS
- Encrypted session storage
- Route-level error boundary
- CI
- Staged AI progress
- Demo planner badge
- Best-effort sync

Düzeltilmesi gerekenler:

### Locale key sayısı

243 ve 253 çelişkisi giderilmeli.

### Instruction uzunluğu

README’de 140, kodda 280. Aynı değere getirilmeli.

### Telemetry persistence

Şu ifade fazla kesin:

```text
Each request writes one row
```

Önerilen ifade:

```text
Each request attempts one telemetry insert; persistence is best-effort.
```

### Rate limit açıklaması

IP tespitinin best-effort olduğu ve `x-forwarded-for` değerinin her ortamda güvenilir olmadığı README’de görünür biçimde belirtilmeli.

---

## 9. Commit öncesi kontrol listesi

### Kod

- [ ] Server’ın kullandığı gerçek `request_id` response metadata’ya eklenmiş mi?
- [ ] `stopping_point` tüm storage ve route akışlarında taşınıyor mu?
- [ ] `difficulty` değerleri ürün davranışıyla uyumlu mu?
- [ ] Quality validation var mı?
- [ ] Malformed server response client’da güvenle reddediliyor mu?
- [ ] Feedback duplicate submission davranışı bilinçli mi?

### README

- [ ] 243/253 çelişkisi giderildi mi?
- [ ] 140/280 çelişkisi giderildi mi?
- [ ] Telemetry persistence best-effort olarak yazıldı mı?
- [ ] Tüm relative linkler gerçekten mevcut mu?
- [ ] AI diagram’daki `request_id` akışı server davranışıyla uyumlu mu?

### Git ve CI

- [ ] `git diff --check`
- [ ] `npm run format:check`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test -- --ci`
- [ ] Deno check
- [ ] Deno tests
- [ ] Gitleaks
- [ ] Çalışma ağacı temiz
- [ ] Tek anlamlı commit

### Gerçek cihaz

- [ ] Türkçe breakdown
- [ ] İngilizce breakdown
- [ ] Structured steps görünümü
- [ ] Stopping point
- [ ] Success feedback
- [ ] Offline fallback
- [ ] History’den eski string step’lerin açılması
- [ ] Logout/login
- [ ] Session restore
- [ ] AI timeout
- [ ] Rate limit
- [ ] Feedback’in server’a gitmesi

---

## Nihai karar

Bu sprintte yapılan değişiklikler önceki halden belirgin biçimde daha güçlü. AI tarafı artık:

- Prompt-driven olmaktan çıkıp contract-driven hale gelmiş.
- Test edilebilir durumda.
- Provider’dan ayrıştırılmış.
- Repair ve fallback davranışı sınırlandırılmış.
- Telemetry ile ölçülebilir.
- Kullanıcı feedback’i ile değerlendirilebilir.

Bu, “AI ekledik” seviyesinden “AI output reliability pipeline kurduk” seviyesine geçiş anlamına geliyor.

Şu an en kritik düzeltmeler:

1. Server’ın kullandığı gerçek `request_id`’yi response’ta döndürmek.
2. README’deki key count ve instruction length çelişkilerini gidermek.
3. Telemetry persistence’ın best-effort olduğunu netleştirmek.
4. `git diff --check` ve format kontrolünü temizlemek.
5. Quality validation testlerini genişletmek.
6. Son değişiklikleri commit etmeden önce CI’yi gerçekten çalıştırmak.

Bunlar tamamlandığında mevcut AI mimarisi portföy sunumu açısından oldukça ikna edici bir seviyeye ulaşmış olacak.
