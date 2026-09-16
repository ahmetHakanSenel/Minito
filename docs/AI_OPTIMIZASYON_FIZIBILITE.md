# AI Optimizasyon Raporu — Entegrasyon Fizibilitesi

`docs/AI_ISTEK_YANIT_OPTIMIZASYON_RAPORU.md` içindeki önerilerin bu projede **gerçekten uygulanabilir olup olmadığının** değerlendirmesi. Her madde için: efor, risk, bağımlılık, engelleyici ve karar.

Değerlendirme 16 Eylül 2026, commit `38eeae6` durumuna göredir.

---

## 0. Fizibilite özeti

| # | Öneri | Rapordaki öncelik | Fizibilite kararı | Efor | Engelleyici |
| - | ----- | ----------------- | ----------------- | ---- | ----------- |
| O-1 | Telemetriyi yanıt yolundan ayır | P1 | **Uygula** | S | Yok |
| O-2 | Gemini moderasyon açığı | P0/P1 | **Uygula** (politika kararı gerekli) | S | Senin kararın |
| O-8 | `finish_reason` kaydet | P1/P2 | **Uygula** | S | Migration 013 |
| O-9 | Token kırılımı | P1 | **Uygula** | M | Migration 013 |
| — | İlk adım `easy` kuralı | "hemen" | **Uygula, ama telemetriden sonra** | S | Sözleşme değişikliği |
| O-7 | `language` kullanımı | P2 | **Uygula** | S | Migration 013 |
| O-5 | Moderasyon + rate limit paralel | P2 | **Uygula** | S | Sıra semantiği kararı |
| — | Provider timeout testi | P2 | **Uygula** | S | Yok |
| O-16 | Gizlilik ifadesi | P3 | **Uygula** (sadece metin) | XS | Yok |
| O-3 | Structured Outputs | P1, ölçümden sonra | **Koşullu** | M | Eval set |
| O-4 | Minimal onarım prompt'u | P1, ölçümden sonra | **Koşullu** | M | Eval set |
| O-11 | Örneği kısaltma | ölçümden sonra | **Koşullu** | S | Eval set + cache ölçümü |
| O-12 | Temperature deneyi | ölçümden sonra | **Koşullu** | S | Eval set + gerçek feedback |
| O-13 | Model env değişkeni | P3 | **Uygula** (deney altyapısı) | XS | Yok |
| O-10 | Prompt cache analizi | ölçümden sonra | **Koşullu** | XS | O-9 |
| O-6 | Yerel JWT doğrulama | P3 | **Erteleme** | L | Güvenlik yüzeyi |
| O-15 | Girdi cache'i | ertelenecek | **Erteleme** | M | Ürün kararı |
| O-14 | Gemini thinking budget | ertelenecek | **Erteleme** (tetikleyici tanımla) | XS | 2.5'e geçiş |
| — | Atomik rate-limit RPC | ertelenecek | **Erteleme** | M | Trafik yok |
| — | Evaluation set | Faz 4 önkoşulu | **Uygula — ve sandığımızdan ucuz** | M | Yok |

Efor ölçeği: XS < 15 dk · S < 1 saat · M yarım gün · L birden fazla gün.

---

## 1. Raporun en önemli varsayımı yanlış: deney için trafik beklemek gerekmiyor

Rapor, Faz 4'ün (Structured Outputs, temperature, prompt kısaltma, model A/B) **en az bir haftalık gerçek trafik** gerektirdiğini söylüyor. Bu, projenin bugünkü durumunda Faz 4'ü aylarca erteler:

- Yeni edge fonksiyonu henüz deploy edilmedi.
- Gerçek kullanıcı sayısı fiilen sıfır.
- Bir A/B karşılaştırması için kol başına en az birkaç yüz örnek gerekir.

Ama ölçmek istediğimiz metriklerin çoğu **kullanıcı gerektirmiyor**:

| Metrik | Gerçek kullanıcı gerekli mi? | Nasıl ölçülür |
| ------ | ---------------------------- | ------------- |
| Schema pass rate | Hayır | Sabit görev setiyle çevrimdışı koşu |
| Repair rate | Hayır | Aynı koşu |
| Fallback rate | Hayır | Aynı koşu |
| Language match | Hayır | Aynı koşu |
| Token / maliyet | Hayır | Aynı koşu |
| p95 AI latency | Hayır (yaklaşık) | Aynı koşu |
| `finish_reason` dağılımı | Hayır | Aynı koşu |
| İlk adımın gerçekten yapılabilirliği | **Evet** | Kullanıcı davranışı |
| `feedback_score` dağılımı | **Evet** | Geri bildirim döngüsü |
| Ton uygunluğu | **Evet** (veya insan değerlendirmesi) | Kullanıcı / manuel inceleme |

**Maliyet hesabı:** 20 görevlik bir set, varyant başına ~20 × 1820 token ≈ 36 bin token ≈ **0,01–0,02 USD**. Yani bir temperature karşılaştırmasının tamamı birkaç sent.

**Sonuç:** Yapısal metrikler bugün ölçülebilir. Yalnızca ton ve memnuniyet soruları gerçek kullanıcı bekler. Bu, raporun "Faz 4'ü bir hafta beklet" tavsiyesini gereksiz kılıyor; eval set'i Faz 2'ye almak gerekiyor.

---

## 2. Projeye özgü sürtünmeler (rapor bunları hesaba katmıyor)

Her öneri bu üç kısıtın içinden geçmek zorunda:

### 2.1. Migration'ları ben uygulayamıyorum

`npx supabase db push` uzak veritabanında geçici rol oluşturmaya çalışıyor ve mevcut yetki buna izin vermiyor (`permission denied to alter role`). 011 ve 012'yi sen panelden çalıştırdın. Yeni kolon isteyen her madde, **senin manuel SQL çalıştırmanı** gerektiriyor.

Pratik sonuç: telemetri kolonlarını (O-8, O-9, O-7) tek bir `013` migration'ında toplamak, üç ayrı tur yerine tek tur demek.

### 2.2. Edge fonksiyonu değişiklikleri manuel deploy gerektiriyor

Fonksiyon kodundaki hiçbir değişiklik push ile canlıya gitmiyor. Ayrıca `EdgeRuntime.waitUntil` gibi yalnızca Supabase çalışma zamanında var olan API'ler **yerelde test edilemiyor**; doğrulama ancak deploy sonrası loglardan yapılabilir.

### 2.3. CI'da AI çağrısı yok ve olmamalı

Eval set CI'ya konulamaz: API anahtarı gerektirir, para harcar ve deterministik değildir. Eval, elle çalıştırılan ve sonucu repoya işlenen bir betik olmalı.

---

## 3. Uygulanabilir maddeler — teknik fizibilite

### 3.1. O-1 · Telemetriyi yanıt yolundan ayırmak

**Karar: Uygula.** Efor S.

Mevcut kodda zaten iki yerde "ateşle ve unut" deseni var (moderasyon ve AI_DOWN kayıtları `.then()` ile yazılıyor, beklenmeden). Yani desen yeni değil; eksik olan, isolate kapanmadan önce yazımın bitme garantisi.

Uygulama:

```ts
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const response = jsonResponse(successPayload, 200);
const write = persistTelemetry(...); // 3 denemeli mevcut döngü

if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
  EdgeRuntime.waitUntil(write);
} else {
  write.catch(() => {}); // yerel çalıştırma ve eski runtime için
}
return response;
```

**Doğrulanan:** Yukarıdaki `declare` bildirimi `deno check`'ten geçiyor (prototiple test ettim). Yerelde `EdgeRuntime` tanımsız olduğu için guard şart.

**Risk:** `waitUntil` mevcut değilse yazım yarıda kesilebilir — bu durumda bugünkünden kötü değiliz, çünkü bugün de aynı desen moderasyon yolunda kullanılıyor.

**Doğrulama:** Deploy sonrası, bir istek atıp `tasks` tablosunda satırın oluştuğunu ve `latency_ms`'in düştüğünü görmek.

### 3.2. O-2 · Gemini moderasyon açığı

**Karar: Uygula, ama önce politika kararı gerekli.** Efor S.

Bu bir kod sorunu değil, bir **ürün/uyumluluk kararı**. Üç seçenek ve gerçek bedelleri:

| Seçenek | Bedeli | Sonuç |
| ------- | ------ | ----- |
| A — Gemini'de de OpenAI anahtarı zorunlu | İki sağlayıcı kimliği yönetmek | En basit, moderasyon sağlayıcıdan bağımsız |
| B — Gemini'nin kendi güvenlik ayarları | `safetySettings` + `finishReason: SAFETY` işleme | Sağlayıcı başına farklı davranış, test yükü |
| C — Açık opt-out | `ALLOW_UNMODERATED=true` istenmedikçe başlatma hatası | Sessiz atlama biter, esneklik kalır |

**Önerim: A + C birlikte.** Varsayılan davranış moderasyonsuz çalışmayı reddetsin; bilinçli olarak kapatmak isteyen açık bir ortam değişkeni koysun. Sessiz atlama her hâlükârda kalkmalı.

**Not:** Bugünkü dağıtım `AI_PROVIDER=openai` olduğu için bu açık **şu an aktif değil**. Yani P0 etiketi doğru ama aciliyeti, Gemini'ye geçme ihtimaline bağlı.

### 3.3. O-8 + O-9 + O-7 · Ölçüm altyapısı (tek migration)

**Karar: Uygula, üçünü birlikte.** Efor M.

`Completion` tipi bugün `{ content, tokenUsage }`. Genişletilmesi gereken zincir:

```text
providers.ts (Completion tipi + iki adapter)
  → pipeline.ts (PipelineResult içinde taşı)
    → index.ts (telemetri nesnesine ekle)
      → migration 013 (kolonlar)
```

Eklenecek alanlar:

| Alan | Kaynak (OpenAI) | Kaynak (Gemini) |
| ---- | --------------- | --------------- |
| `finish_reason` | `choices[0].finish_reason` | `candidates[0].finishReason` |
| `prompt_token_usage` | `usage.prompt_tokens` | `usageMetadata.promptTokenCount` |
| `completion_token_usage` | `usage.completion_tokens` | `usageMetadata.candidatesTokenCount` |
| `cached_token_usage` | `usage.prompt_tokens_details.cached_tokens` | `usageMetadata.cachedContentTokenCount` |
| `response_language` | `breakdown.language` | aynı |
| `language_match` | `detectLanguage(input) === breakdown.language` | aynı |

**Önemli incelik:** Onarım turu olduğunda iki çağrının token'ları toplanıyor. Kırılımı da toplamak doğru, ama `finish_reason` için **hangisini** saklayacağımıza karar vermek gerek. Önerim: son çağrının değeri + ayrı bir `repair_finish_reason` yerine, sadece ilk çağrının `finish_reason`'ı — çünkü asıl merak ettiğimiz "ilk cevap neden bozuldu" sorusu.

**Risk:** Düşük. Alanların hepsi nullable; sağlayıcı vermezse `null` kalır.

**Bağımlılık:** Migration 013'ü senin çalıştırman gerekiyor.

### 3.4. İlk adımın `easy` olması kuralı

**Karar: Uygula — ama raporun dediği gibi Faz 1'de değil, telemetriden sonra.** Efor S.

**Doğrulandı:** Prototiple test ettim, mevcut Zod sürümünde `.min(3).max(7).refine(...).superRefine(...)` zinciri çalışıyor, `ResponseBodySchema` içindeki `.optional()` kullanımı bozulmuyor ve üretilen hata mesajı onarım turuna tam istediğimiz biçimde gidiyor:

```text
steps.0.difficulty: The first step must be easy
```

**Raporla ayrıştığım nokta:** Rapor bunu "hemen yapılacaklar"a koyuyor ve "en yüksek değerli, en düşük riskli değişiklik" diyor. Katılmıyorum, çünkü bu bir **çıktı sözleşmesi değişikliği**:

1. Modelin bugün ne sıklıkla `medium` ile başladığını bilmiyoruz. Kural bugün eklenirse onarım oranı bilinmeyen bir miktarda artar.
2. Sözleşme değiştiği için `PROMPT_VERSION` de `task-breakdown-v2` olmalı — yoksa telemetride iki farklı sözleşmenin sayıları karışır ve hiçbir karşılaştırma yapılamaz.
3. Telemetri henüz hiç veri toplamadı. Kuralı önce koyarsak, "onarım oranı yükseldi mi" sorusunun referans noktası olmaz.

**Doğru sıra:** Önce ölçüm altyapısı → birkaç gün/eval koşusu ile referans al → sonra kuralı ekle ve `v2` olarak etiketle → farkı ölç.

**Ek not:** Prompt zaten "Step 1 builds momentum and is always easy" diyor. Yani kural yeni bir ürün davranışı değil, mevcut talimatın zorunlu kılınması.

### 3.5. O-5 · Moderasyon ve rate limit'i paralel çalıştırmak

**Karar: Uygula.** Efor S.

Rapor bunu "kolay ve düşük riskli" diyor; doğru, ama bir semantik kararı atlamış: **ikisi birden tetiklenirse hangisi kazanır?**

Bugün rate limit hiç çalışmıyor, çünkü işaretlenen içerik erken dönüyor. Paralelde:

- İçerik işaretli **ve** kota aşılmış → hangisi döndürülecek?
- Önerim: **moderasyon kazanır.** Kullanıcı kriz içerikli bir şey yazdıysa ona "çok fazla istek attın" demek yanlış olur; panik kiti gösterilmeli.

Kazanç 30–100 ms. Küçük ama bedava.

### 3.6. Provider timeout testi

**Karar: Uygula.** Efor S.

`providers.test.ts` bugün 8 testi kapsıyor ama zaman aşımı yolunu test etmiyor. `AbortSignal.timeout` ile iptal edilen bir çağrının:

- `null` döndürdüğünü,
- yeniden denendiğini (timeout `ProviderError` değil, yani retry edilebilir),
- ölçüme dahil edildiğini

doğrulayan bir test eklenebilir. Sahte sağlayıcı zaten var; sadece uzun süren bir `send` ve kısa bütçe gerekiyor.

### 3.7. O-13 · Model adını ortam değişkenine almak

**Karar: Uygula.** Efor XS.

Deney altyapısının önkoşulu; `ai_model` telemetrisi zaten hazır. Tutarsızlığı da giderir (Gemini env'den okunuyor, OpenAI sabit).

### 3.8. O-16 · Gizlilik ifadesi

**Karar: Uygula (yalnızca metin).** Efor XS.

Raporun önerdiği daha uzun ifade doğru. Ancak `tasks.steps` kolonunu kaldırma önerisine **karşıyım**: modelin ne ürettiğini geriye dönük inceleyemezsek kalite analizi yapamayız; Day-2 gözlemlenebilirliğinin bütün amacı bu. Tablo zaten servis rolüne kapalı. Doğru çözüm ifadeyi düzeltmek, veriyi atmak değil.

---

## 4. Koşullu maddeler — önce eval set

Bu dördü de aynı önkoşula bağlı: **sabit bir görev seti üzerinde ölçüm.**

### 4.1. Evaluation set (önkoşul)

**Karar: Uygula.** Efor M.

Tasarım:

```text
docs/eval/tasks.json        → 20 görev (10 TR / 10 EN, farklı kategoriler ve uzunluklar)
scripts/eval.ts             → elle çalıştırılan Deno betiği
docs/eval/results/<sürüm>.json → koşu çıktısı, repoya işlenir
```

Her koşu şunları raporlar: schema pass rate, repair rate, fallback rate, language match, ortalama/p95 latency, ortalama token, `finish_reason` dağılımı, tahmini maliyet.

**Kısıt:** CI'da çalışmaz (anahtar + maliyet + belirsizlik). Elle çalıştırılır.
**Maliyet:** Koşu başına ~0,01–0,02 USD.
**Değer:** Structured Outputs, minimal repair, temperature ve prompt kısaltma kararlarının **hepsi** bununla verilebilir. Tek başına en yüksek kaldıraçlı madde.

### 4.2. O-3 · Structured Outputs

**Karar: Koşullu — eval set sonrası.** Efor M.

Rapor faydaları doğru sayıyor ama iki fizibilite detayını atlıyor:

1. **Çift kaynak riski.** Zod şeması ile JSON Schema'yı elle senkron tutmak zorundayız. Ya `zod-to-json-schema` bağımlılığı eklenecek (yeni bağımlılık, Deno'da esm.sh üzerinden) ya da elle yazılıp **iki yapının aynı kaldığını doğrulayan bir test** eklenecek. İkincisini öneriyorum: `Object.keys(TaskBreakdownSchema.shape)` ile JSON Schema `properties` anahtarlarını karşılaştıran bir Deno testi, bağımlılık eklemeden sapmayı yakalar.
2. **Strict mod bizim kısıtlarımızın çoğunu desteklemiyor.** Dizi eleman sayısı, sayı aralığı ve metin uzunluğu sınırları strict şemada geçersiz. Yani 3–7 adım, 1–10 dakika ve karakter sınırları **yine Zod'da kalacak**. Onarım hattı kaldırılamaz, sadece daha az tetiklenir.

Beklenen kazanç gerçek: enum ve tip hataları tamamen biter. Ama "onarım oranı sıfırlanır" beklentisi yanlış olur.

### 4.3. O-4 · Minimal onarım prompt'u

**Karar: Koşullu.** Efor M.

Raporun uyarısı yerinde: ton katmanı çıkarılırsa model persona'yı bozabilir. Ancak şunu eklemek gerek — **onarım oranı zaten düşükse bu optimizasyonun toplam etkisi önemsizdir.** Onarım turu isteklerin %3'ünde oluyorsa, %55 tasarruf toplam maliyette %1,5 kazanç demektir.

Yani sıralama: önce onarım oranını ölç. %10'un altındaysa bu maddeyi tamamen düşür.

### 4.4. O-11 ve O-12 · Örnek kısaltma ve temperature

**Karar: Koşullu.** Efor S (her biri).

İkisi de eval set ile birkaç sent karşılığında ölçülebilir. Tek uyarı: temperature kararı yalnızca yapısal metriklerle verilemez — ton kaybı ancak insan değerlendirmesi veya gerçek `feedback_score` ile görülür. Eval set "0.4 daha az onarım üretiyor" der; "0.4 daha soğuk yazıyor" demez.

Önerim: yapısal metrikler eval ile, ton için eval çıktılarından 10 örneği elle okumak.

---

## 5. Ertelenmesi gerekenler

| Madde | Neden şimdi değil |
| ----- | ----------------- |
| O-6 · Yerel JWT doğrulama | 50–150 ms kazanç için JWKS rotasyonu, iptal edilmiş token davranışı ve anahtar yönetimi riski. O-1 uygulandığında bu gecikme zaten bütçeyi zorlamayacak |
| O-15 · Girdi cache'i | Raporun ürün itirazına katılıyorum. Ayrıca tekrar oranını ölçmeden çözüm aramak anlamsız; O-9 sonrası `input_hash` tekrarına bakılabilir |
| O-14 · Gemini thinking budget | Bugün `gemini-2.0-flash` kullanılıyor, sorun yok. **Ama tetikleyici tanımlanmalı:** `GEMINI_MODEL` 2.5'e alınacaksa aynı PR'da thinking budget ayarı da girmeli. Bunu README'ye yazmak yeterli |
| Atomik rate-limit RPC | Yarış koşulu gerçek ama trafiksiz bir üründe etkisi yok. Trafik geldiğinde bakılır |

---

## 6. Raporun atladığı entegrasyon detayları

Fizibilite açısından bunlar, raporun kendi maddelerinden daha kritik:

1. **Sözleşme değiştiğinde `PROMPT_VERSION` mutlaka artmalı.** Rapor dört varyant öneriyor (`-strict`, `-low-temp`, `-short-example`) ama bunun **koşullu seçim mekanizması gerektirdiğini** söylemiyor. Bugün `PROMPT_VERSION` bir sabit. A/B için ya ortam değişkeni ya da kullanıcı kimliğine göre deterministik kova (`hash(user.id) % 100 < 50`) gerekiyor. Yaklaşık 20 satır, ama planda hiç yok.

2. **İki varyant, iki kat veri demek.** Trafiksiz bir üründe aynı anda birden fazla deney çalıştırmak, hiçbirinden sonuç alamamak demektir. Eval set bu sorunu ortadan kaldırır (deterministik, tekrarlanabilir, ucuz) — bir sebep daha.

3. **Onarım turunun telemetrisi eksik.** Bugün `breakdown_source` "onarım oldu mu" diyor ama "neden" demiyor. `finish_reason` ile birlikte **ilk turun hata kodlarını** (`steps.0.difficulty`, `language` gibi issue yollarını) de kaydetmek, hangi kuralın ne sıklıkla ihlal edildiğini gösterir. Bu, prompt'u nokta atışı düzeltmenin tek yolu ve rapor bundan hiç bahsetmiyor. Loglarda zaten var (`validation_issues`), sadece veritabanına taşınmıyor.

4. **Eval set'in ikinci bir faydası var:** regresyon koruması. Prompt'a dokunan her değişiklikten sonra aynı 20 görev koşulup schema pass rate'in düşmediği görülebilir.

---

## 7. Önerilen paketleme

Üç ayrı tur. Her tur tek deploy ve en fazla bir migration.

### Paket A — Güvenlik ve yanıt penceresi

**İçerik:** O-1 (waitUntil), O-2 (moderasyon politikası), O-5 (paralel kontroller), provider timeout testi, O-16 (metin), O-13 (model env).
**Migration:** Yok.
**Deploy:** `break-task`.
**Test:** Mevcut Deno testleri + 1 yeni timeout testi.
**Geri alma:** Kod geri alınır, şema değişmediği için veri riski yok.
**Senin yapman gereken:** Moderasyon politikası kararı (A / B / C), sonra deploy.

### Paket B — Ölçüm altyapısı

**İçerik:** O-8, O-9, O-7, onarım issue kodlarının kaydı, eval set ve betiği.
**Migration:** 013 (yaklaşık 7 nullable kolon).
**Deploy:** `break-task`.
**Test:** Adapter'ların yeni alanları doğru okuduğunu doğrulayan Deno testleri.
**Geri alma:** Kolonlar nullable, eski kod yeni şemayla sorunsuz çalışır.
**Senin yapman gereken:** 013 SQL'ini panelde çalıştırmak, sonra deploy.

### Paket C — Sözleşme ve deneyler

**İçerik:** İlk adım `easy` kuralı (`task-breakdown-v2`), varyant seçim mekanizması, ardından eval sonuçlarına göre Structured Outputs / temperature / örnek kısaltma.
**Önkoşul:** Paket B canlıda ve en az bir eval koşusu yapılmış.
**Migration:** Yok.
**Geri alma:** `PROMPT_VERSION` geri alınır; telemetride iki sürüm ayrı durduğu için karşılaştırma bozulmaz.

---

## 8. Senin karar vermen gerekenler

1. **Moderasyon politikası:** Gemini dağıtımında OpenAI anahtarı zorunlu mu olsun (A), Gemini'nin kendi güvenlik ayarları mı kullanılsın (B), yoksa açık bir opt-out ortam değişkeni mi olsun (C)? Önerim A+C.
2. **Paket A'yı deploy etmeden mi, ettikten sonra mı B'ye geçelim?** Önerim: A'yı deploy edip bir gün gerçek kullanımda bırakmak, sonra B.
3. **Eval set'in kapsamı:** 20 görev yeterli mi, yoksa kategori başına (temizlik, çalışma, iş, sağlık, sosyal, finans) 5'er görevle 30'a mı çıkaralım? Maliyet farkı birkaç sent.
4. **İlk adım `easy` kuralı:** Referans ölçüm olmadan hemen eklemek istersen ekleyebilirim — ama o zaman etkisini ölçemeyeceğimizi bilerek yapmalıyız.
