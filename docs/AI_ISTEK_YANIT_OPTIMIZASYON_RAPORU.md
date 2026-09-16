# Minito — AI İstek/Yanıt Optimizasyon Raporu

## Yönetici özeti

`docs/AI_ISTEK_YANIT_RAPORU.md` mevcut AI akışını ayrıntılı ve doğru biçimde belgeliyor. Sistem artık basitçe “AI’dan JSON alıp parse eden” bir yapı değil; aşağıdaki katmanlara sahip bir AI pipeline’ı:

```text
Prompt assembly
→ Provider JSON mode
→ JSON parse
→ Zod validation
→ Tek repair
→ Deterministic fallback
→ Telemetry
→ User feedback
```

Bundan sonraki en büyük kazanım yeni bir özellik eklemekten çok, şu dört hedefi birlikte optimize etmek olacaktır:

1. Kullanıcıya doğru ve uygulanabilir ilk adımı göstermek.
2. Safety ve timeout davranışlarını garanti altına almak.
3. Kötü cevapları kullanıcıya ulaşmadan düzeltmek.
4. Model, prompt, maliyet ve kullanıcı memnuniyetini ölçerek karar vermek.

Ana önerilen sıra:

```text
Safety ve timeout garantisi
→ Schema + quality validation
→ Finish/token/language telemetry
→ Evaluation set
→ Kontrollü prompt/model deneyleri
→ Gerçek kullanıcı feedback’i ile seçim
```

---

## 1. Mevcut pipeline’ın güçlü yönleri

### 1.1. Prompt mimarisi doğru katmanlanmış

Mevcut system prompt beş katmana ayrılmış:

1. Identity
2. Rules
3. Tone
4. Decomposition
5. Output Contract

| Katman | Sorumluluk |
|---|---|
| Identity | Modelin ürün içindeki rolünü sınırlar |
| Rules | Güvenlik, untrusted input ve kapsam sınırları |
| Tone | Üslup ve dil |
| Decomposition | Micro-step üretme kuralları |
| Output Contract | Makine tarafından işlenebilir cevap biçimi |

Bu ayrım prompt’un tek parça ve kontrol edilemez hale gelmesini engelliyor.

### 1.2. Output contract ürün hedefiyle uyumlu

Mevcut alanlar:

- `language`
- `empathy_bridge`
- `first_step_hook`
- `steps`
- `stopping_point`

Özellikle `stopping_point`, Minito’nun temel ürün felsefesini güçlendiriyor:

> Kullanıcı işi tamamen bitirmese bile ilerleme değerlidir.

### 1.3. JSON mode ve Zod doğrulaması doğru kombinasyon

Provider JSON mode yalnızca geçerli JSON üretmeye yardımcı oluyor. Alanların doğru olup olmadığı Zod ile kontrol ediliyor.

Mevcut akış:

```text
Provider JSON mode
→ JSON.parse
→ TaskBreakdownSchema.safeParse
→ geçerliyse kabul
→ geçersizse tek repair
→ yine geçersizse fallback
```

Bu, üretim ortamı için doğru bir savunma katmanıdır.

### 1.4. Repair sayısı kontrollü

Mevcut sistem:

- İlk üretimde transport retry yapabilir.
- Schema hatasında tek repair gönderir.
- Repair çağrısı tekrar transport retry’ye sokulmaz.
- Repair de başarısızsa deterministic fallback kullanılır.

Bu karar:

- latency’yi sınırlar,
- maliyeti kontrol eder,
- kararsız model davranışını uzatmaz,
- kullanıcıyı gereksiz bekletmez.

---

## 2. Optimizasyonların yeniden önceliklendirilmesi

Raporlanan optimizasyonları dört sınıfa ayırmak daha sağlıklı olur.

### Gerçek üretim riski

- Cevap penceresinin taşması
- Gemini seçiliyken moderasyonun devre dışı kalabilmesi
- `finish_reason` okunmaması
- Telemetry ile model davranışının yeterince ayrıştırılamaması

### Düşük riskli kalite iyileştirmesi

- İlk step’in `easy` olmasını schema ile zorlamak
- `language` alanını kullanmak veya kaldırmak
- Repair prompt’unu kısaltmak
- Moderasyon ve rate limit’i paralel çalıştırmak
- Provider timeout testi eklemek

### Ölçüm olmadan karar verilmemesi gerekenler

- Temperature düşürmek
- Türkçe örneği kaldırmak
- Structured Outputs’a geçmek
- Prompt’u kısaltmak
- Model değiştirmek
- AI cevap cache’i uygulamak

### Şimdilik ertelenebilecekler

- Yerel JWT doğrulaması
- Sessiz input cache’i
- Gemini thinking budget değişikliği
- Dinamik model seçimi
- Tam maliyet hesaplama
- Atomik rate-limit RPC migration’ı

---

## 3. O-1 — Cevap penceresinin taşması

### Bulguyu değerlendirme

Bu, mevcut pipeline’daki en önemli performans sorunlarından biridir.

Mevcut bütçeler:

```text
Server AI budget: 17 saniye
Tek provider çağrısı: 9 saniye
Client timeout: 20 saniye
Telemetry retry beklemeleri: 1 + 2 saniye
```

AI çıktısı hazırlandıktan sonra telemetry yazımı response’tan önce yapılıyor. Persistence başarısız olursa:

1. İlk insert deneniyor.
2. 1 saniye bekleniyor.
3. İkinci insert deneniyor.
4. 2 saniye bekleniyor.
5. Üçüncü insert deneniyor.
6. Ancak bundan sonra response dönüyor.

Böyle bir durumda:

- AI planı hazır olabilir.
- Telemetry yazımı gecikebilir.
- Client 20 saniyede timeout olabilir.
- Kullanıcı gerçek AI planı yerine offline fallback görebilir.
- AI maliyeti yine de oluşmuş olur.

### Öncelik

**P1.** Altyapı hatası sırasında kullanıcıya doğrudan yanlış deneyim sunabileceği için bazı durumlarda P0 etkisi yaratabilir.

### Önerilen çözüm

Telemetry yazımını kullanıcı response yolundan ayırın:

```text
AI sonucunu hazırla
→ response’u hemen gönder
→ telemetry persistence’ı background’da tamamla
```

Supabase Edge Runtime destekliyorsa:

```ts
const response = jsonResponse(successPayload, 200);

EdgeRuntime.waitUntil(
  persistTelemetryWithRetry(...)
);

return response;
```

### Uygulama notları

- Response’un telemetry retry’larını beklememesi gerekir.
- Background persistence başarısız olursa structured warning loglanmalıdır.
- Feedback için kullanılacak request ID response içinde korunmalıdır.
- `waitUntil` güvenilir biçimde kullanılamıyorsa persistence için kısa bir bütçe uygulanmalıdır.

Alternatif:

- Response öncesi en fazla tek hızlı insert denemesi.
- Retry’ların response sonrasına taşınması.
- Telemetry hatasının kullanıcı deneyimini bloklamaması.

---

## 4. O-2 — Gemini seçiliyken moderasyon açığı

### Mevcut davranış

`checkModeration()` yalnızca `OPENAI_API_KEY` varsa moderation çalıştırıyor.

Dolayısıyla:

```text
AI_PROVIDER=gemini
OPENAI_API_KEY yok
```

durumunda içerik moderasyonu sessizce atlanıyor.

### Neden önemli?

Bu bir model kalite problemi değil, safety problemidir. Kullanıcı güvenliğiyle ilgili route’un provider seçimine bağlı olması doğru değildir.

### Öncelik

**P0/P1 arası gerçek bir güvenlik konusu.**

### Önerilen seçenekler

#### Seçenek A — OpenAI moderation key’ini zorunlu kılmak

Gemini deployment’ında da `OPENAI_API_KEY` zorunlu tutulur.

Avantajları:

- En hızlı çözüm.
- Mevcut moderation kodu korunur.
- Safety davranışı provider’dan bağımsız olur.

Dezavantajları:

- Gemini-only deployment mümkün olmaz.
- İki farklı provider credential’ı gerekir.

#### Seçenek B — Provider bağımsız safety classifier

Moderation için bağımsız bir safety servisi veya model kullanılır.

Avantajı:

- AI provider ile moderation ayrılır.

Dezavantajları:

- Yeni servis ve maliyet ekler.
- Operasyonel karmaşıklığı artırır.

#### Seçenek C — Moderation kullanılamıyorsa güvenli route

Moderation çalışmıyorsa normal AI akışına devam etmek yerine sınırlı ve güvenli bir response route’u kullanılır.

Kısa vadede öneri:

> Gemini aktifse de OpenAI moderation key’i zorunlu olsun veya deploy startup’ında moderation’ın kapalı olduğu açık bir configuration failure olarak raporlansın. Sessizce atlamak doğru değildir.

---

## 5. O-3 — OpenAI Structured Outputs

### Mevcut durum

Şu an OpenAI için:

```ts
response_format: { type: 'json_object' }
```

kullanılıyor.

Bu yalnızca syntax garantisi sağlar.

### Önerilen hedef

OpenAI JSON Schema ve strict output kullanılabilir:

```ts
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'task_breakdown',
    strict: true,
    schema: ...
  }
}
```

### Beklenen faydalar

- Alanların varlığı
- Enum değerleri
- Primitive türler
- Property isimleri
- Nesting yapısı

model tarafından daha tutarlı üretilir.

### Sınırlamalar

Strict schema bütün business rule’ları çözmez. Uygulama tarafındaki validation yine gerekir:

- 3–7 step sınırı
- İlk step’in kolay olması
- Step’lerin atomic olması
- Sürelerin gerçekçi olması
- Dil eşleşmesi

### Önerilen karar

1. Önce mevcut repair oranını ölçün.
2. OpenAI Structured Outputs branch’i ekleyin.
3. Aynı evaluation set üzerinde karşılaştırın.
4. Repair oranı, latency ve feedback score’u birlikte değerlendirin.

### Öncelik

**P1**, ancak ölçümden sonra uygulanmalı.

---

## 6. O-4 — Repair turunu ucuzlatma

### Mevcut durum

Repair isteğinde şu içerikler tekrar gönderiliyor:

1. Tam system prompt
2. Tam user prompt
3. Geçersiz assistant output
4. Validation issue listesi

Bu, repair input maliyetini yükseltiyor.

### Önerilen minimal repair prompt

```text
SYSTEM:
You are repairing a structured response.
Preserve the task meaning and language.
Return only the required JSON.

OUTPUT CONTRACT:
...

VALIDATION ISSUES:
...

INVALID RESPONSE:
...
```

### Risk

Tam tone ve decomposition kuralları çıkarılırsa:

- Dil tonu değişebilir.
- Model yalnızca syntax’ı düzeltip ürün persona’sını bozabilir.
- Repair yeni bir plan üretmeye dönüşebilir.

### Önerilen deney

#### A — Tam context repair

Mevcut yaklaşım korunur.

#### B — Minimal repair

- Output contract
- Tone
- Issue listesi
- Invalid output

Sonuçları şu metriklerle karşılaştırın:

- `source: repaired` oranı
- Feedback score
- Language match
- Latency
- Input token
- Toplam maliyet

Bu deney yapılmadan doğrudan minimal repair’a geçilmemeli.

---

## 7. O-5 — Moderasyon ve rate limit’i paralel çalıştırma

### Mevcut durum

Mevcut sıra:

```text
Moderation
→ Rate limit
→ AI
```

Moderation ve rate limit birbirinden bağımsızdır.

### Öneri

```ts
const [moderationResult, rateLimitResult] = await Promise.all([
  checkModeration(sanitizedInput, openaiKey),
  checkRateLimit(user.id, ipHash, supabase),
]);
```

### Önemli nokta

Rate limit aşılmış olsa bile moderation çağrısı yapılmış olur. Bu küçük bir ek maliyet yaratabilir.

Bu nedenle karar:

- Latency öncelikliyse paralel çalıştırın.
- Moderation maliyeti öncelikliyse mevcut sıralı yapıyı koruyun.

### Öncelik

**P2.** Kolay ve düşük riskli latency iyileştirmesidir.

---

## 8. O-6 — JWT doğrulamasını yerelleştirme

### Mevcut davranış

```ts
supabase.auth.getUser(token)
```

her istekte Supabase Auth’a ağ çağrısı yapıyor.

### Yerel doğrulamanın olası faydası

- 50–150 ms gecikme azaltılabilir.
- Auth servisine bağımlılık azalır.

### Yerel doğrulamanın riskleri

- JWKS rotation yönetimi
- JWT secret/configuration yönetimi
- Revoked token davranışının değişmesi
- Audience/issuer doğrulama hataları
- Key cache yönetimi

### Öncelik

**P3.** Mevcut sprintte yapılması önerilmez. Kazanç sınırlıyken güvenlik yüzeyini büyütür.

---

## 9. O-7 — `language` alanının kullanılması

### Mevcut durum

- Schema `language` istiyor.
- Model `language` üretiyor.
- Client bu alanı kullanmıyor.
- Fallback kendi regex’ine bakıyor.

Bu, küçük bir token maliyetine ek olarak gereksiz repair tetikleyicisi olabilir.

### Önerilen kullanım

Alanı kaldırmak yerine telemetry ve quality validation’da kullanın:

```ts
meta: {
  prompt_version,
  source,
  requested_language,
  response_language,
  language_match,
}
```

Eşleşmiyorsa:

- Quality issue üretilebilir.
- Repair tetiklenebilir.
- Telemetry sinyali olarak kaydedilebilir.

### Öncelik

**P2.** Düşük eforlu ve ölçüm değeri yüksek bir iyileştirmedir.

---

## 10. O-8 — `finish_reason` ve çıktı tavanı

### Mevcut durum

Model çıktısı yarım kaldığında akış bunu yalnızca JSON parse hatası olarak görüyor.

Olası sebepler:

- Model contract’i ihlal etti.
- Token limitine çarptı.
- Provider boş cevap döndü.
- Safety veya content filter devreye girdi.

### Önerilen provider tipi

```ts
type Completion = {
  content: string;
  tokenUsage: number;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
};
```

OpenAI’den:

```ts
finishReason: data.choices?.[0]?.finish_reason
```

Gemini’den:

```ts
finishReason: data.candidates?.[0]?.finishReason
```

### Telemetry değerleri

- `stop`
- `length`
- `content_filter`
- `MAX_TOKENS`
- `SAFETY`

### Öncelik

**P1/P2.** Maliyetsiz bir gözlemlenebilirlik iyileştirmesi olarak önce uygulanmalıdır.

---

## 11. O-9 — Token telemetrisi

### Mevcut durum

Yalnızca:

```ts
token_usage
```

saklanıyor.

### Önerilen model

```ts
type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
};
```

Database alanları:

- `prompt_token_usage`
- `completion_token_usage`
- `cached_token_usage`
- `token_usage`

### Faydaları

- Gerçek maliyet hesaplanabilir.
- Prompt’un maliyet payı görünür.
- Repair’ın maliyeti ölçülebilir.
- Prompt caching doğrulanabilir.
- Türkçe ve İngilizce farkı izlenebilir.

### Öncelik

**P1.** Sonraki optimizasyon kararlarını mümkün kıldığı için önemlidir.

---

## 12. O-10 ve O-11 — Prompt cache ve örnek metni

System prompt yaklaşık 1172 token ve içindeki örnek yaklaşık 247 token.

Örnek her istekte gönderiliyor; İngilizce görevlerde de kullanılıyor.

### Önemli denge

Örneği kaldırmak:

- Input token maliyetini azaltabilir.
- Output contract uyumunu düşürebilir.
- Repair oranını artırabilir.
- Prompt cache eşiğinin altına düşürebilir.

Bu nedenle:

1. Token telemetrisi eklenmeli.
2. Cached token bilgisi ölçülmeli.
3. Mevcut repair oranı izlenmeli.
4. Örnek kısaltılmış versiyonla denenmeli.
5. Tam kaldırma ancak ölçümler destekliyorsa yapılmalı.

### Önerilen ilk deney

Tam örneği kaldırmak yerine:

- 3 step yerine 1 step gösterin.
- Uzun içerikleri kısaltın.
- Field shape ve ID sıralamasını koruyun.

```json
{
  "language": "tr",
  "empathy_bridge": "...",
  "first_step_hook": "...",
  "steps": [
    {
      "id": "step-1",
      "title": "...",
      "instruction": "...",
      "estimated_minutes": 1,
      "difficulty": "easy"
    }
  ],
  "stopping_point": "..."
}
```

---

## 13. O-12 — Temperature optimizasyonu

Mevcut `temperature: 0.7` değeri ölçülmemiş bir varsayım.

### Önerilen deney

| Varyant | Temperature |
|---|---:|
| A | 0.7 |
| B | 0.4 |

Her iki varyant aynı evaluation set üzerinde çalıştırılmalı.

Ölçülecekler:

- Schema pass rate
- Repair rate
- Fallback rate
- Feedback score
- İlk step tamamlama oranı
- Empathy feedback
- Ortalama token
- p95 latency

Yalnızca repair oranı düştü diye düşük temperature seçilmemeli. Tonun soğuması ve cevapların tekdüzeleşmesi de ölçülmeli.

Minito için daha gerçekçi kalite fonksiyonu:

```text
overall_quality =
  structural_validity
  + first_step_usability
  + tone_fit
  + language_match
  + user_feedback
```

---

## 14. O-13 ve O-14 — Model seçimi

### OpenAI modelini environment variable yapmak

Şu yapı daha esnek olur:

```env
OPENAI_MODEL=gpt-4o-mini
```

Faydaları:

- Deploy ile model değiştirilebilir.
- A/B test yapılabilir.
- `ai_model` telemetrisi zaten karşılaştırma için hazırdır.

Bu değişiklik **P3** seviyesinde uygulanabilir.

### Gemini thinking budget

Gemini 2.5 modellerine geçiş planlanıyorsa thinking budget provider-specific olarak kontrol edilmelidir.

Ancak mevcut default `gemini-2.0-flash` olduğu için bu bugünün kritik konusu değildir.

Bu ayar yalnızca `GEMINI_MODEL` gerçekten 2.5’e alınmadan önce test edilmelidir.

---

## 15. O-15 — HMAC input cache’i

Aynı input için cache kullanmak teknik olarak maliyeti düşürebilir. Ancak ürün davranışını kötüleştirme riski vardır:

- Kullanıcı aynı görevi farklı ruh haliyle tekrar yazabilir.
- Aynı task için farklı mikro-step seti motive edici olabilir.
- İsim veya dil değişmiş olabilir.
- Önceki plan artık uygun olmayabilir.

Bu nedenle sessiz cache yerine daha iyi ürün davranışı:

```text
Aynı görevin önceki planı bulundu.
Önceki planı aç veya yeni bir plan üret.
```

Önce yalnızca tekrar oranını ölçün. Cache anahtarı değerlendirirken:

- user ID
- language
- prompt version
- model
- time window

hesaba katılmalıdır.

---

## 16. O-16 — Privacy ifadesinin netleştirilmesi

“Kullanıcının ham görev metni analytics için düz metin olarak saklanmaz” ifadesi doğrudur. Ancak modelin ürettiği step metinleri görevin içeriğini kısmen açığa çıkarabilir.

Daha doğru ifade:

```text
Kullanıcının ham görev girdisi analytics için düz metin olarak saklanmaz; HMAC olarak saklanır. AI tarafından üretilen yapılandırılmış plan kalite analizi için ayrı metadata ile birlikte tutulabilir. Kullanıcının görünür task history’si ise RLS ile yalnızca sahibine açıktır.
```

Daha sıkı veri minimization istenirse:

- `tasks.steps` analytics tablosundan kaldırılabilir.
- Analytics yalnızca şu alanları tutabilir:
  - step count
  - average duration
  - source
  - token usage
  - latency
  - feedback
- Structured steps yalnızca owner-only `task_breakdowns` tablosunda tutulabilir.

---

## 17. Önerilen uygulama planı

### Faz 1 — Hemen yapılacaklar

#### 1. AI response’unu telemetry’den bağımsız döndürün

- Response telemetry retry’larını beklememeli.
- Background persistence veya kısa bütçeli best-effort write kullanılmalı.
- Kullanıcıya AI planı hazır olduğu halde offline fallback gösterilmesi önlenmeli.

#### 2. Gemini moderation açığını kapatın

En kısa güvenli yol:

- Gemini deployment’ında OpenAI moderation key’ini zorunlu kılmak.
- Key yoksa function configuration failure üretmek.
- Sessizce moderation atlamamak.

#### 3. İlk step’in easy olmasını kodla zorlayın

```ts
const TaskBreakdownSchema = z.object({
  ...
  steps: z.array(StepSchema)
    .min(3)
    .max(7)
    .superRefine((steps, ctx) => {
      if (steps[0]?.difficulty !== 'easy') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [0, 'difficulty'],
          message: 'The first step must be easy',
        });
      }
    }),
});
```

### Faz 2 — Ölçüm altyapısı

4. `finish_reason` ekleyin.
5. Prompt ve completion token sayılarını ayrı kaydedin.
6. Cached token değerini destekleyin.
7. Requested language ve response language eşleşmesini ölçün.
8. Telemetry persistence başarı/başarısızlık durumunu izleyin.

### Faz 3 — Düşük riskli optimizasyonlar

9. Moderation ve rate limit’i paralel çalıştırmayı değerlendirin.
10. OpenAI modelini environment variable yapın.
11. Provider timeout testini ekleyin.
12. Retryable ve non-retryable provider davranışlarını ayrı loglayın.

### Faz 4 — Kontrollü AI deneyleri

En az bir hafta gerçek trafik veya sabit evaluation set ile veri topladıktan sonra:

- OpenAI Structured Outputs
- Minimal repair prompt
- Temperature karşılaştırması
- Kısa ve uzun prompt örneği
- Model A/B testi

uygulanabilir.

Her varyant ayrı prompt versiyonuyla ölçülmeli:

```text
task-breakdown-v1
task-breakdown-v1-strict
task-breakdown-v1-low-temp
task-breakdown-v1-short-example
```

---

## 18. Başarı kriterleri

### Teknik metrikler

| Metrik | Başlangıç hedefi |
|---|---:|
| İlk seferde schema pass | >95% |
| Repair rate | <%5 |
| Fallback rate | <%1 |
| Provider timeout rate | <%1 |
| p95 AI latency | Ürün hedefi altında |
| p95 total latency | 20 saniyenin güvenli biçimde altında |
| Telemetry persistence failure | <%1 |
| Language mismatch | <%1 |

### Ürün metrikleri

| Metrik | Anlamı |
|---|---|
| İlk step completion | Minito’nun ana değer önerisi |
| `helpful` oranı | Planın kullanıcıya uyumu |
| `too_large` oranı | Micro-step kalitesi |
| `too_small` oranı | Aşırı parçalama |
| `wrong_tone` oranı | Persona ve prompt kalitesi |
| Session completion | Akışın gerçek kullanım değeri |
| Resume rate | Kalıcı oturumun faydası |

Ana başarı metriği:

> Kullanıcı ilk adımı gerçekten tamamlıyor mu?

---

## 19. Nihai karar listesi

### Şimdi yapılması önerilenler

1. Telemetry yazımını response latency yolundan ayırın.
2. Gemini moderation davranışını sessiz skip olmaktan çıkarın.
3. İlk step’in `easy` olmasını schema veya quality validation’a ekleyin.
4. `finish_reason` kaydedin.
5. Provider timeout testini ekleyin.
6. README’de ham metin ve üretilen plan ayrımını netleştirin.

### Veri geldikten sonra yapılması önerilenler

7. OpenAI Structured Outputs.
8. Minimal repair prompt.
9. Temperature deneyi.
10. Prompt örneğini kısaltma deneyi.
11. Prompt cache etkisi analizi.
12. Model A/B testi.

### Şimdilik yapılmaması önerilenler

13. Yerel JWT doğrulamasına geçmek.
14. Sessiz input cache’i uygulamak.
15. Gemini thinking budget’i mevcut model kullanılmıyorken değiştirmek.
16. Rate limit için RPC migration’ını acil sprint işi yapmak.

---

## Sonuç

Mevcut AI sistemi teknik olarak iyi bir temel üzerinde. En önemli eksik artık “model daha iyi cevap versin” değil:

> Hangi cevapların gerçekten iyi olduğunu ölçebilecek ve kötü cevapları kullanıcıya ulaşmadan düzeltecek kalite katmanının genişletilmesi.

Minito için en etkili optimizasyon sırası:

```text
Safety ve timeout garantisi
→ Schema + quality validation
→ Finish/token/language telemetry
→ Evaluation set
→ Kontrollü prompt/model deneyleri
→ Gerçek kullanıcı feedback’i ile seçim
```

Tek bir değişiklik hemen uygulanacaksa, en yüksek değerli ve en düşük riskli değişiklik:

```text
steps[0].difficulty === 'easy'
```

kuralını schema veya quality validation katmanında zorunlu hale getirmektir.

En yüksek operasyonel değerli değişiklik ise:

```text
Telemetry persistence’ı response latency yolundan ayırmak
```

olur. Bu iki değişiklik birlikte hem kullanıcı deneyimini hem de Minito’nun temel ürün vaadini doğrudan güçlendirir.
