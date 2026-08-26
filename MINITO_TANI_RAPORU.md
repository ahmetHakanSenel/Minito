# Minito — A'dan Z'ye Ürün Tanı Raporu

**Panel:** CPO · Kıdemli UI/UX Tasarımcısı · Davranış Psikoloğu · Baş AI Mühendisi
**Tarih:** 2026-08-02
**Dayanak:** Pazarlama materyalleri değil, Expo/React Native uygulamasının (`app/`, `src/`, `supabase/functions/break-task`) tam kaynak kodu incelemesi. Aşağıdaki her iddia, geldiği dosyayı referans gösterir.

---

## Yönetici Özeti

Minito'nun temel döngüsü — *bunaltıcı bir görevi yaz → AI bir empati köprüsü, "aptalca kolay" bir kanca ve atomik mikro-adımlar döndürür → tek seferde bir adım şeklinde rehberli odak akışı* — gerçekten güçlü, savunulabilir bir ürün tezi. "Nöro-Bilişsel Yoldaş" prompt'u (`supabase/functions/break-task/index.ts`) ürünün en iyi tasarlanmış parçalarından biri.

Ancak uygulama şu anda **farklı olgunluk seviyelerinde birbirine tutturulmuş üç ayrı ürün** halinde:

| Katman | Olgunluk | Değerlendirme |
|---|---|---|
| AI görev-bölme döngüsü (Ana Ekran → Odak) | ~%80 yayınlanabilir | Gerçek ürün bu. Bunu cilalayın. |
| Planlayıcı (projeler/görevler) | ~%30 — **kalıcılık yok, AI stub, sabit kodlanmış demo veri** | Bugün veri kaybı ile yayınlanır |
| İstatistik/Analitik | ~%20 — **`Math.random()` ile sahte veri render ediyor** | Yayınlanırsa güveni doğrudan zedeler |

Ayrıca bir **marka kimliği çelişkisi** var: beyan edilen konumlandırma "zen/minimalist," ama uygulanan şey dopamin-maksimalist (neon mor, konfeti topları, her scroll hareketinde "GOD MODE" titreşimi, nabız gibi atan aurora). Bu çözülebilir bir durum — ama kazara değil, bilinçli olarak çözülmesi gerekiyor.

---

## 1. UI/UX ve Tasarım Dili Derin İncelemesi

### 1.1 Görsel Kimlik — Mevcut Durum

`tailwind.config.js` ve `AuroraBackground.tsx`'ten:

| Token | Değer | Amaç |
|---|---|---|
| `background` | `#050510` "Deep Void" | Saf siyah değil — OLED banding'i önler. İsabetli bir tercih. |
| `surface` | `#1E1E1E` | Kart/reklam arka planı |
| `primary` | `#8B5CF6` Neon Mor | Eylem |
| `success` | `#34D399` Nane Yeşili | "Dopamin" |
| `textMain` / `textMuted` | `#E5E5E5` / `#A1A1AA` | Ana/ikincil metin |

Ayrıca: animasyonlu aurora blob'ları (10sn nefes alma, 18sn lav lambası kayması), `expo-blur`, `LinearGradient`, Lottie, Skia, konfeti topu.

### 1.2 Temel Kimlik Çatışması

**"Zen minimalist" ile inşa edilen şey aynı uygulama değil.** Yapılan şey daha çok *yönetici işlev bozukluğu yaşayan beyinler için neon bir salon oyunu* — ve açıkçası, sistem prompt'unuzun hedeflediği DEHB kitlesi için bu *doğru* ürün. Zen uygulamaları (Headspace-sakinliği, bej, yavaş) kaygı düzenlemesi içindir. Sizin kullanıcılarınızın ihtiyacı **aktivasyon** — yani dopamin, hareket ve ödül.

**Öneri:** İç tasarım dilini "zen"den **"Sakin Enerji"**ye yeniden markalayın — karanlık, sessiz *ambiyans* bir taban (aurora, void arka plan: korunsun) ile *kazanılmış* kutlama patlamaları (konfeti sadece tam tamamlamada, adım başına değil). Gitmesi gereken şey *kazanılmamış, ambiyans* uyarım:

- `app/index.tsx:33-41` — "GOD MODE: Scroll'da seçim titreşimi" scroll sırasında her 300ms'de bir tetikleniyor. Bu geri bildirim değil, duyusal gürültü. Titreşimler **anlama bağlı** olmalı (bir adım tamamlandı, bir zamanlayıcı bitti) yoksa hiçbir şeye alışkanlık oluşturur ve pili tüketirler. **Kaldırın.**
- Altı doygun proje rengi (`app/planner.tsx:47-54`) + neon mor + nane yeşili + pembe konfeti aynı anda planlayıcıda görünür olması 8+ tonluk bir palet demek. Ekran başına aktif doygun renk sayısını 2 ile sınırlayın.

### 1.3 Sürtünme Noktaları (önem sırasına göre)

1. **Zorunlu 2,5 saniyelik adımlar-arası animasyon** (`app/focus.tsx:105-110`): bir adım tamamlandıktan sonra, kullanıcı sonraki adım görünmeden önce `PremiumStepAnimation`'ın 2500ms'sini *beklemek zorunda*. Momentum kazanmış bir DEHB kullanıcısı için 2,5sn zorunlu duraklama bir sonsuzluk — tam da dikkatin kaçtığı türden ölü bir zaman aralığı. Kutlama asla ilerlemeyi bloke etmemeli. Çözüm: animasyonu sonraki adımın girişiyle *eş zamanlı* oynatın veya dokunarak geçilebilir yapın. Hedef: sonraki adım <400ms içinde görünür olsun.
2. **Akış-ortası durum kalıcı değil**: adımlar router parametrelerinde JSON olarak taşınıyor (`app/focus.tsx:42`) ve başka hiçbir yerde yaşamıyor. İşletim sistemi uygulamayı kapatırsa (çok olası — kullanıcının fiziksel adımı yapmak için uygulamadan *ayrılması gerekiyor*!), tüm oturum kayboluyor. Bu, sizin özel kitleniz için en zarar verici tek UX kusuru: uygulamanın temel kullanım senaryosu "telefonu bırak ve o şeyi yap" ve uygulama tam da bunu cezalandırıyor. Aktif oturum durumunu depolamaya kaydedin ve yeniden açılışta geri yükleyin ("Tekrar hoş geldin — 3. adımdaydın").
3. `JSON.parse(params.steps)` try/catch içermiyor (`app/focus.tsx:42`) — bozuk bir parametre odak ekranını doğrudan çökertir.
4. **Kutsal alan ekranında reklam**: `NativeAdCard` ana ekranda duruyor (`app/index.tsx`), temiz bir başlangıç ritüeli gibi hissettirmesi gereken tek ekranda. Reklamlar var olmak zorundaysa, başarı ekranına konsun (ödül sonrası, ruh hali yüksek) — asla giriş veya odak yüzeylerine değil.
5. **Navigasyon asimetrisi**: alt ekranlar `router.replace('/', { openDashboard: 'true' })` (`app/stats.tsx:118`) ile dönüyor — bir modal'ı yeniden açan parametre tabanlı bir hack. Çalışıyor, ama geri-jesti davranışı öngörülemez olacak. Dashboard alt öğeleri için gerçek bir tab/stack yapısı düşünün.
6. Sabit kodlanmış `userName="Kullanıcı"` ve `isPremium={false}` (`app/index.tsx:133-134`) — üretim UI'ında görünür bir yer tutucu.
7. **Sadece karanlık mod** (`app.json: userInterfaceStyle: "dark"`) savunulabilir bir estetik tercih, ama `AuroraBackground` `Reduce Motion` erişilebilirlik ayarlarını yok sayıyor — sürekli hareket bir WCAG 2.3.3 sorunu ve nöroçeşitli kullanıcıların bir kısmını gerçekten rahatsız ediyor. Tüm ambiyans animasyonlarını `useReducedMotion()` arkasına alın.

### 1.4 Duyusal Deneyim — Neler Eklenmeli (ve Neler Eklenmemeli)

| Öğe | Öneri |
|---|---|
| **Titreşim** | Kalsın: adım tamamlanınca başarı bildirimi, navigasyonda hafif darbe. Kaldırılsın: scroll titreşimleri. Eklensin: tek, *belirgin* bir "oturum tamamlandı" titreşim deseni (kullanıcılar bunu bir imza gibi öğrenir). |
| **Ses** | `ambientAudio` stub halinde bırakılmış ("varlık eklenene kadar devre dışı", `app/focus.tsx:15-16`) ama bir Sesler ekranı ve oturum "AMBİYANS" seçici (Kahverengi Gürültü / Yağmur / Lo-Fi, `en.json`) bunu zaten vaat ediyor. Çalmayan sesler için seçici yayınlamak tutulmamış bir söz — ya gerçek varlıkları şimdi bağlayın ya da seçiciyi gizleyin. Kahverengi gürültü DEHB odaklanması için bilimsel olarak iyi bir tercih; buna öncelik verin. |
| **Etkileşim çanları** | Adım tamamlanınca yumuşak bir çan, ardışık adımlarda *perde-yükselen* (1. adım = Do, 2. adım = Mi, 3. adım = Sol…). Ucuza inşa edilir, bilinçaltı bir ilerleme merdiveni yaratır, derinden tatmin edici. Sessiz moda her zaman saygı gösterin. |
| **Mikro-etkileşimler** | Aurora'yı zamanlayıcıyla senkronize eden tamamlanma nabzı (`focus.tsx:49-55`) mükemmel — ortam "sizinle birlikte nefes alıyor." Bunu genişletin: aurora odak oturumları sırasında *daha yavaş* kaysın, oturum tamamlanmaya yaklaştıkça hafifçe *parlaklaşsın*. |

---

## 2. AI Mantığı ve Algoritmik Zafiyetler

### 2.1 Gerçekten İyi Olan Şeyler

- Prompt personası (empati köprüsü → dopamin-öncelikli kanca → atomik mikro-adımlar → durma izni) davranışsal olarak okur-yazar ve iyi belirtilmiş, few-shot örnekler ve katı JSON şeması ile.
- Fail-soft mimarisi (çevrimdışı yedek adımlar, işaretlenen içerik için panik kiti, bloke etmek yerine log'layan Zod doğrulaması) olgun düşünceyi gösteriyor.
- Tasarım gereği gizlilik: girdiler hash'leniyor, asla düz metin olarak saklanmıyor, GDPR export/silme fonksiyonlarıyla birlikte. Ruh sağlığına yakın bir uygulama için gerçek bir farklılaştırıcı bu.

### 2.2 Tuzaklar (önem sırasına göre)

1. **En kötü durum gecikmesi felaket düzeyinde ve görünmez.** `callOpenAI` üstel geri çekilmeyle (1sn, 2sn beklemeler) 3 kez deniyor; `callGemini` 3 deneme × 2 API sürümü yapıyor. Zayıflamış bir sağlayıcı, kullanıcının "Minitizing..." buton etiketine **20-40+ saniye** bakması demek — tanımlayıcı özelliği bekleyememek olan bir kullanıcı için. Etki sırasına göre çözümler:
   - Tüm işlem için ~8sn'lik sert bir zaman aşımı; bundan sonra çevrimdışı yedek adımları *hemen* sunun ve gerçek sonuç gelirse daha sonra gelsin.
   - Yükleme durumuna duygusal iş yaptırın: her 2sn'de bir mikro-metni döndürün ("Satır aralarını okuyorum…", "En kolay ilk hamleyi buluyorum…"). Metrik algılanan gecikme, gerçek gecikme değil.
   - Uzun vadede: yanıtı stream edin — `empathy_bridge` şema sırasına göre önce gelir, böylece adımlar üretilirken ~1sn içinde gösterebilirsiniz.
2. **Rate limiting mevcut değil.** `checkRateLimit` sadece saatte >50 istekte `console.warn` yapıyor ve asla bloke etmiyor (`break-task/index.ts:261-292`). Endpoint sadece herkese açık anon key ile çağrılabiliyor. Uygulama binary'sinden key'i çıkaran herkes (bu önemsiz bir iş) OpenAI bütçenizi sınırsızca tüketebilir. Bu bir **UX tercihi değil, maliyet-güvenlik açığı**. Gerçek bir guest başı ve global limit uygulayın (örn. guest_id başına saatte 20, `RATE_DOWN` döndürün — istemci bu sebebi zaten işliyor).
3. **HMAC gerçekte HMAC değil.** `sanitizeAndHash` `SHA-256(key ‖ mesaj)` hesaplıyor (`break-task/index.ts:180`) — length-extension saldırısına açık ve kendi gizlilik politikası metninizin tarif ettiği gizlilik garantisi değil ("HMAC_SHA256", `en.json`). Gerçek bir HMAC key ile `crypto.subtle` kullanın. Gizlilik iddianız şu anda uygulamanızdan daha güçlü.
4. **Tekrar büyüyü öldürür.** Yarın aynı görev → yapısal olarak özdeş empati köprüsü ("Bunun zor hissettirdiğini biliyorum…") → persona 5. günde şablon gibi okunur. `empathy_bridge`'in yeniliği *değer kaybeden bir varlık*. Hafifletmeler: yanıt sözleşmesini çeşitlendirin (bazen empati köprüsü yok, bazen meydan okuma tonu), gün/saat bağlamı enjekte edin, uzun vadede anonimleştirilmiş sinyalleri geri besleyin ("kullanıcı bugün 3 oturum tamamladı") kazanılmış çeşitlilik için.
5. **Mikro-adım kalitesi hiç zorlanmıyor.** Prompt ≤10 dakikalık atomik adımlar *istiyor*, ama çıktı granülerliğini hiçbir şey doğrulamıyor. `gpt-4o-mini` 0.8 sıcaklıkta periyodik olarak "Dosyalarını düzenle" gibi çıktılar üretecek — tam olarak prompt'un uyardığı "BAŞARISIZ OLDUN" durumu. Ucuz bir son-kontrol ekleyin: adım uzunluğu >80 karakter veya bağlaç kalıpları içeriyorsa ("ve sonra", "and then") → işaretleyin veya yeniden bölün.
6. **Dil uyumsuzlukları, iki kez.**
   - Panik kiti **edge fonksiyonu içinde Türkçe olarak sabit kodlanmış** (`break-task/index.ts:743-762`) ve kullanıcı diline bakılmaksızın sunuluyor. Kriz anındaki İngilizce konuşan bir kullanıcı Türkçe kriz-destek metni alıyor. İstemcide düzgün i18n panik içeriği var (`en.json: panic.*`) — sunucu sadece bir sebep kodu döndürmeli ve istemcinin yerelleştirilmiş içeriği render etmesine izin vermeli.
   - Çevrimdışı yedek kategorileyici sadece **İngilizce anahtar kelimelerle** eşleşiyor (`src/lib/offlineFallback.ts`) — "Odamı temizle" GENEL adımlara düşüyor, oysa Türkçe açıkça birincil pazarınız (prompt örnekleriniz Türkçe).
7. **Gemini maliyet takibi bozuk**: token kullanımı 0'a sabit kodlanmış (`break-task/index.ts:611`). Görev başına Gemini harcamanızı göremiyorsunuz. `usageMetadata.totalTokenCount`'u parse edin.
8. **60 saniyelik prompt önbelleği büyük ölçüde dekoratif** — edge fonksiyon örnekleri geçici olduğundan, modül seviyesindeki önbellek soğuk başlatmalar arasında nadiren hayatta kalıyor. Zararsız, ama maliyet kontrolü için buna güvenmeyin.
9. **Parsing yedek zinciri kaynağında düzeltilmeye değer bir koku**: yapılandırılmış çıktı kullanılmadığı için ~140 satırlık regex/satır tabanlı kurtarma parsing'i (`parseAiResponse`) var. Hem OpenAI (`response_format: json_schema`) hem de Gemini (`responseMimeType: application/json` + `responseSchema`) zorunlu JSON destekliyor. Bunları benimseyin ve kurtarma kodunun çoğunu silin.
10. **Moderasyon fail-open**: moderasyon API'si hata verirse, girdi güvenli sayılıyor (`checkModeration`). Savunulabilir bir fail-soft tercih, ama panik-kiti güvenlik ağının OpenAI kesintileri sırasında sessizce kaybolduğunu bilin — bu olduğunda bir Sentry uyarısına değer.

### 2.3 Güven ve Kurtarma UX

| An | Mevcut | Olması Gereken |
|---|---|---|
| AI düşünüyor | Buton etiketi değişimi ("Minitizing...") | Dönen empatik mikro-metinlerle tam yüzey düşünme durumu; aurora hafifçe hızlanır. Asla ölü bir spinner değil. |
| AI yanlış/çok büyük adımlar | Kullanıcı bunlarla sıkışıp kalır | Adım başına "çok mu büyük?" affordance'ı → yerel bölme veya bir kez yeniden deneme. Tek dokunuş, yazma yok. |
| Çevrimdışı yedek | Banner: "Çevrimdışısınız. Yedek içerik kullanılıyor." | Dürüst ama soğuk. Yeniden çerçeveleyin: "Bağlantı yok — yine de sağlam bir başlangıç planı burada." Yedek bir özür değil, bir özellik. |
| Tam başarısızlık | 503 → banner | Manuel yolu sunun: "Kendi 3 adımını yaz" — AI olmadan ritüeli canlı tutar. |

**İlke:** kullanıcı "AI çöktü" ifadesinin "Minito işe yaramaz" anlamına geldiğini asla öğrenmemeli. Her başarısızlık yolu yine de *atılacak bir ilk adımla* bitmeli.

---

## 3. Ürün-Pazar Uyumu ve Psikolojik Elde Tutma

### 3.1 Ağrı Kesici mi, Vitamin mi?

**Ağrı kesici — koşullu olarak.** Görev başlatma felci (DEHB'deki "korku duvarı," yönetici işlev bozukluğu) akut, tekrarlayan, *hissedilen* bir acı ve çaresizce kendi kendine tedavi eden bir kitle var (bkz: Goblin Tools'un Magic ToDo'su tam olarak bu mekanikle milyonlarca kullanıcıya ulaştı, r/ADHD'nin body doubling ve mikro-görevlere olan takıntısı). Acı gerçek ve bu niş içinde ödeme isteği bir üretkenlik uygulaması için alışılmadık derecede yüksek.

Koşullar:

- **Ağrı kesici görev-bölme döngüsü, nokta.** Planlayıcı ve istatistik ekranları bir ağrı kesiciye vidalanmış vitaminler — ve mevcut hallerinde (sahte veri, kalıcılık yok) *zehirler*, çünkü proje listesini bir kez kaybeden bir DEHB kullanıcısı bir daha asla veri girmez.
- **Hendeğiniz mekanik değil, ses.** Herkes gpt-4o-mini'yi çağırıp görevleri bölebilir. Kopyalanması zor olan şey kullanıcıların *bağ kurduğu* bir persona — empati köprüsü, mizah, "durma izni." Prompt kalitesine, TR/EN arasında ton tutarlılığına ve yanıt çeşitliliğine orantısız yatırım yapın. Marka bu.
- **Konumlandırma riski:** "DEHB için Nöro-Bilişsel Yoldaş" tıbba yakın bir iddia. Mağaza listelerinde sıkı sıkıya "odak ve görev yoldaşı" dilinde kalın; DEHB topluluk pazarlaması topluluk kanallarında olur, App Store metadata'sında değil (bu aynı zamanda App Review sürtünmesini de önler).

### 3.2 Kanca Modeli, inşa edilenle eşleştirilmiş

| Kanca aşaması | Mevcut durum | Boşluk / Çözüm |
|---|---|---|
| **Tetikleyici** (dış) | Yok. Bildirim yok, widget yok, kısayol yok. | Bu en büyük elde tutma boşluğu. Felç anı uygulamanın *dışında* gerçekleşiyor. Yayınlayın: giriş alanlı ana ekran widget'ı, kullanıcının kendi beyan ettiği niyete bağlı tek, saygılı günlük bildirim ("Bugün tezle yüzleşmek istemiştin — ilk aptalca kolay adımı ister misin?"). |
| **Tetikleyici** (iç) | Güçlü potansiyel: "başlayamıyorum" *hissi* → Minito. | Onboarding'de pekiştirin: "sıkıştığını hissettiğinde, işte o senin işaretin" diye açıkça öğretin. Hissi isimlendirin. |
| **Eylem** | İyi: tek girdi, tek buton. | Bunu koruyun. Ana ekrana asla ikinci zorunlu bir alan eklemeyin. |
| **Değişken ödül** | Konfeti + başarı ekranı — sabit, dolayısıyla değer kaybediyor. | Değişkenlik *AI'nin sesinden* gelmeli (şaşırtıcı empati köprüleri, ara sıra mizah ikramiyesi) ve ara sıra nadir kutlamalardan (10'da 1 özel animasyon). `StreakFlame` mevcut — iyi — ama DEHB kullanıcıları için streak'lerin **onarım mekanizmaları olmalı** ("streak dondurma" veya "geri dönüş" durumu). Zarafet olmadan bozulan bir streak motivasyon değil, kayıp olayıdır: bu kitle utanç-hassas, ve ürünün tüm önermesi "seni yargılamıyoruz." |
| **Yatırım** | Neredeyse hiç yok — gizlilik hash'lemesi uygulamanın *kullanıcı hakkında hiçbir şey hatırlamaması* anlamına geliyor. | Bu, mimarideki derin gerilim: **gizlilik-öncelik (her şeyi hash'le) vs. kişiselleştirme (yoldaş seni tanır)**. İstemci tarafında çözün: görev geçmişini, tamamlama kalıplarını ve tercih edilen tonu *cihaz üzerinde* (veya hesap başına, şifreli) saklayın, özetleri prompt'a besleyin. Sunucu kör kalsın; yoldaş bir hafıza kazansın. Amnezik bir yoldaş sadece bir formatlayıcıdır. |

### 3.3 Kullanıcılar Neden Geri Gelir (veya Gelmez)

Elde tutma önceliğe göre üç döngüye bağlı olacak:

1. **Rahatlama Döngüsü (günlük):** felç → Minito'da 60 saniye → şeyi başlattı → rahatlama. Bu *sürtünmesiz ve hızlı* olmalı (yukarıdaki gecikme + widget'a bakın). Her saniyelik gecikme ve her zorunlu animasyon kayıptır.
2. **Kimlik Döngüsü (haftalık):** "Ben artık işleri başlatan biriyim." Başarı ekranı ara sıra sadece sayı değil, kimliği yansıtmalı ("İşte duvarı yendiğin 4. sabah üst üste"). Gerçek istatistikler — gerçek tamamlanan oturumlar, gerçek streak'ler — bunu besler. Sahte istatistikler bunu yok eder.
3. **Yoldaş Döngüsü (aylık):** kullanıcı Minito'nun sesinin kendisini *tanıdığını* fark eder (kalıplarına atıfta bulunur, tonu ayarlar). Bu hendek ve premium gerekçesi.

---

## 4. Ana Eylem Planı

### 🔴 Kritik / Acil (yayınlama-engelleyicileri — bu hafta)

| # | Durum | Eylem | Kanıt | Efor |
|---|---|---|---|---|
| 1 | ✅ Tamamlandı | **Planlayıcı verisini kalıcı hale getirin** (`ProjectContext` arkasında AsyncStorage/SQLite) ve süresi geçmiş tarih dahil sabit kodlanmış Türkçe örnek projeleri kaldırın (`ProjectContext.tsx:46-85`) | Her yeniden başlatmada veri kaybı | M |
| 2 | ✅ Tamamlandı | **İstatistik ekranını kaldırın veya gerçek verinin arkasına alın** — şu anda `Math.random()` render ediyor (`app/stats.tsx:27-77`) | Sahte analitik = güven yıkımı | S (perde arkasına al) |
| 3 | ⬜ Bekliyor | **AdMob test ID'lerini değiştirin** (`app.json`'daki `ca-app-pub-3940256099942544…` Google'ın örnek ID'leri) veya v1 için reklamları kaldırın | Gelir yok + mağaza politikası riski | S |
| 4 | ✅ Tamamlandı | Edge fonksiyonunda **gerçek rate limiting uygulayın**; anon-key endpoint'i açık bir cüzdan | `break-task/index.ts:261-292` | M |
| 5 | ✅ Tamamlandı | **8sn AI zaman aşımı → anında çevrimdışı yedek** ekleyin; 20-40sn'lik en kötü durum beklemesini öldürün | `callOpenAI`/`callGemini`'deki retry matematiği | S |
| 6 | ✅ Tamamlandı | **Aktif odak oturumunu kalıcı hale getirin** ve yeniden açılışta geri yükleyin; `JSON.parse(params.steps)`'i try/catch'e sarın | `app/focus.tsx:42` | M |
| 7 | ✅ Tamamlandı | Panik kitini sunucu tarafında yerelleştirin (sebep kodu döndürün, istemci tarafında i18n render edin) | `break-task/index.ts:743`'te sabit TR | S |
| 8 | ✅ Tamamlandı | Geliştirme kalıntılarını yayın paketinden kaldırın: `app/aura-demo.tsx` rotası, çift `LivingAuraOrb` (`src/components/` ve `src/components/analytics/`), sabit kodlanmış `userName="Kullanıcı"` / `isPremium={false}` | `app/index.tsx:133` | S |

### 🟡 Kısa Vadeli (2-6 hafta)

| # | Durum | Eylem | Gerekçe |
|---|---|---|---|
| 9 | ⬜ Bekliyor | Adımlar-arası kutlamayı bloke etmeyen/atlanabilir yapın (sonraki adıma <400ms) | Momentum ürünün ta kendisi |
| 10 | ⬜ Bekliyor | Yapılandırılmış JSON çıktısına geçin (OpenAI `json_schema` / Gemini `responseSchema`); kurtarma parser'larını silin | Güvenilirlik + kod sağlığı |
| 11 | ⬜ Bekliyor | `offlineFallback.ts` kategorileyicisine Türkçe anahtar kelimeler ekleyin | Birincil pazar kapsamı |
| 12 | ⬜ Bekliyor | Sahte HMAC'i düzeltin → gerçek `crypto.subtle` HMAC-SHA256; kodu gizlilik iddiasıyla hizalayın | Temel farklılaştırıcınızın bütünlüğü |
| 13 | ⬜ Bekliyor | Düşünme-durumu UX'i: dönen mikro-metin, aurora tepkisi; hata yolları her zaman uygulanabilir bir adımla bitsin | Güven ve kurtarma |
| 14 | ⬜ Bekliyor | Gerçek ambiyans sesini bağlayın (önce kahverengi gürültü) veya ambiyans seçiciyi gizleyin | Mevcut UI'da tutulmamış söz |
| 15 | ⬜ Bekliyor | Scroll titreşimlerini kaldırın; imza tamamlanma titreşimi + yükselen adım çanları ekleyin | Sadece anlama bağlı geri bildirim |
| 16 | ⬜ Bekliyor | Adım başına "çok mu büyük?" → yeniden bölme affordance'ı | Yazmadan AI kurtarması |
| 17 | ⬜ Bekliyor | `generateSubtasks` stub'unu gerçek edge fonksiyonuna bağlayın | `ProjectContext.tsx:112` |
| 18 | 🟡 Kısmen | Gerçek oturum verisinden gerçek istatistikler (oturumlar, dakikalar, streak); Gemini token kullanımını parse edin — *oturum/dakika verisi gerçek, streak entegrasyonu ve Gemini token parse'ı henüz yapılmadı* | Kimlik döngüsü + maliyet görünürlüğü |
| 19 | 🟡 Kısmen | Aurora ve konfeti üzerine `useReducedMotion()` kontrolü — *sadece LivingAuraOrb'da var, AuroraBackground ve confetti'de henüz yok* | Erişilebilirlik (WCAG 2.3.3) |
| 20 | ⬜ Bekliyor | Streak'ler öne çıkarılmadan önce streak onarım mekanizması | Utanç-hassas kitle |

### 🟢 Uzun Vadeli (çeyrek+)

| # | Durum | Eylem | Gerekçe |
|---|---|---|---|
| 21 | ⬜ Bekliyor | **Ana ekran widget'ı + paylaşım-sayfası yakalama** ("Bunu Minitize et") | Dış tetikleyici — elde tutmanın kilit taşı |
| 22 | ⬜ Bekliyor | **Cihaz üzerinde yoldaş hafızası** (geçmiş, ton tercihi, tamamlama kalıpları prompt'a beslenir; sunucu kör kalır) | Gizlilik-vs-kişiselleştirme gerilimini çözer; hendeği inşa eder |
| 23 | ⬜ Bekliyor | Yanıt akışı (empati köprüsü ~1sn içinde) | Algılanan gecikme → sıfıra yakın |
| 24 | ⬜ Bekliyor | Premium katman: sınırsız minitizasyon, yoldaş hafızası, ambiyans kütüphanesi, reklamsız (ücretsiz: günde N) | DEHB nişinde yüksek ödeme isteği var; kullanım tabanlı maliyetlere tavan gerekli |
| 25 | ⬜ Bekliyor | Niyet tabanlı günlük bildirim (jenerik değil, kullanıcı tarafından yazılmış) | Tetikleyici döngü, saygıyla yapılmış |
| 26 | ⬜ Bekliyor | TR/EN genelinde persona için ton tutarlılığı değerlendirme altyapısı (altın-küme prompt'lar, sesi regresyon-test edin) | Ses markanın ta kendisi — bir API sözleşmesi gibi koruyun |
| 27 | ⬜ Bekliyor | Body-doubling / birlikte odaklanma (başkalarının odaklanan ambiyans varlığı) | Uygulamada henüz olmayan, bilinen en güçlü DEHB elde tutma mekanizması |

**İlerleme:** Kritik/Acil 7/8 tamamlandı · Kısa Vadeli 0/12 tamamlandı, 2/12 kısmen · Uzun Vadeli 0/7

---

## Kapanış Değerlendirmesi

Görev-bölme döngüsü, persona prompt'u, fail-soft mimarisi ve gizlilik duruşu gerçek bir kitlesi olan gerçek bir ürün. Yayınlamaya giden yol daha fazla eklemek değil — **planlayıcıyı ve istatistikleri dürüst durumlara indirmek, maliyet/gecikme açıklarını kapatmak, ve temel döngünün tasarlandığı kadar hızlı ve sıcak olmasına izin vermek**. Kimliği belirleyin ("Sakin Enerji," zen değil), her titreşimi ve konfeti patlamasını *kazanılmış* yapın, ve yoldaşa bir hafıza verin. Sistem prompt'unun zaten vaat ettiği uygulama bu.
