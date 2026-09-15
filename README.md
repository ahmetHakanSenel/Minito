# Minito

**Büyük görevleri başlatılabilir mikro-adımlara bölen, DEHB odaklı bir mobil odak uygulaması.**

Minito, “yapamıyorum” hissini yaşadığın anlarda devreye girer: görevini yazarsın, yapay zeka onu empati köprüsü + aptalca kolay ilk adım + atomik mikro-adımlara böler; sen de tek seferde bir adım tamamlayarak ilerlersin.

> Bu README, projeyi hiç bilmeyen biri için yazıldı. Kurulumdan mimariye, ekran ekran kullanımdan SSS’ye kadar aradığın her şey burada.

---

## İçindekiler

- [Minito nedir?](#minito-nedir)
- [Temel akış (30 saniyede anla)](#temel-akış-30-saniyede-anla)
- [Gereksinimler](#gereksinimler)
- [Hızlı başlangıç](#hızlı-başlangıç)
- [Ortam değişkenleri (.env)](#ortam-değişkenleri-env)
- [Supabase kurulumu (backend)](#supabase-kurulumu-backend)
- [Uygulamayı çalıştırma](#uygulamayı-çalıştırma)
- [Uygulamayı kullanma (ekran rehberi)](#uygulamayı-kullanma-ekran-rehberi)
- [Proje yapısı](#proje-yapısı)
- [Teknoloji yığını](#teknoloji-yığını)
- [Mimari ve veri akışı](#mimari-ve-veri-akışı)
- [Geliştirme ipuçları](#geliştirme-ipuçları)
- [Ek dokümantasyon](#ek-dokümantasyon)
- [SSS (Sık Sorulan Sorular)](#sss-sık-sorulan-sorular)
- [Bilinen sınırlamalar](#bilinen-sınırlamalar)
- [Lisans ve katkı](#lisans-ve-katkı)

---

## Minito nedir?

Minito bir **görev başlatma (task initiation) aracıdır**. Klasik yapılacaklar listesi değil; “duvara çarptığın” anlarda seni harekete geçiren bir **Nöro-Bilişsel Yoldaş**.

| Özellik | Açıklama |
|--------|----------|
| **AI görev bölme** | “Evi topla”, “Tez yaz” gibi bunaltıcı görevleri 5–10 dakikalık mikro-adımlara ayırır |
| **Empati köprüsü** | “Bunun zor hissettirdiğini biliyorum…” tarzı, yargısız bir giriş |
| **İlk adım kancası** | Paralizi kırmak için “aptalca kolay” bir başlangıç (ör. sadece bir çorap topla) |
| **Rehberli odak modu** | Adımları tek tek tamamlarsın; zamanlayıcı, titreşim, kutlama animasyonları |
| **Gizlilik öncelikli** | Görev metnin sunucuda düz metin olarak saklanmaz — yalnızca hash kaydedilir |
| **Çevrimdışı yedek** | AI veya internet yoksa yerel fallback adımlar devreye girer |
| **TR / EN** | Türkçe ve İngilizce arayüz |

---

## Temel akış (30 saniyede anla)

```
Ana ekran → Görev yaz → "Minito'la!" → AI adımları üretir
    → Odak modu (empati + adımlar) → Her adımı "YAPTIM" ile tamamla
    → Başarı ekranı → Ana ekrana dön
```

Uygulamadan çıkıp telefonu bıraksan bile oturum **cihazda kaydedilir**; ana ekranda “Kaldığın yerden devam et” banner’ı görürsün.

---

## Gereksinimler

| Araç | Minimum sürüm | Not |
|------|---------------|-----|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **npm** | 9+ | Node ile gelir |
| **Git** | — | Repoyu klonlamak için |
| **Expo Go** veya **Expo Dev Client** | — | Telefonda test için |
| **Supabase hesabı** | Ücretsiz tier yeterli | AI özelliği için zorunlu |
| **OpenAI API key** | — | Edge Function’da kullanılır |

**İsteğe bağlı:**
- Android Studio / Xcode — native build için
- EAS CLI — mağaza build’i için (`eas build`)
- Google Cloud Console — Google ile giriş için
- Apple Developer — Apple ile giriş için (iOS)

---

## Hızlı başlangıç

```bash
# 1. Repoyu klonla
git clone <repo-url>
cd minito

# 2. Bağımlılıkları yükle
npm install

# 3. Ortam değişkenlerini ayarla (aşağıdaki bölüme bak)
# Proje kökünde .env dosyası oluştur

# 4. Uygulamayı başlat
npm start
```

Terminalde QR kod çıkar. **Expo Go** uygulamasıyla (Android/iOS) QR’ı okut veya:
- `a` → Android emülatör
- `i` → iOS simülatör (macOS)
- `w` → Web tarayıcı

> **Not:** AI özelliği Supabase kurulumu olmadan çalışmaz; kurulum yoksa uygulama **çevrimdışı fallback** modunda açılır.

---

## Ortam değişkenleri (.env)

Proje kökünde `.env` dosyası oluştur. Bu dosya `.gitignore`’da — **asla Git’e commit etme.**

```env
# ── Zorunlu (AI + veritabanı) ──────────────────────────────
EXPO_PUBLIC_SUPABASE_URL=https://XXXXXXXXXXXXX.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Edge Function URL (opsiyonel — URL otomatik türetilebilir)
EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL=https://XXXXXXXXXXXXX.supabase.co/functions/v1/break-task

# ── İsteğe bağlı ───────────────────────────────────────────
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
EXPO_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

| Değişken | Ne işe yarar? |
|----------|---------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase proje adresi |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Frontend’in kullandığı public API anahtarı |
| `EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL` | `break-task` AI fonksiyonunun adresi |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth girişi |
| `EXPO_PUBLIC_SENTRY_DSN` | Hata izleme (Sentry) |

Değerleri Supabase Dashboard → **Settings → API** bölümünden alırsın.

---

## Supabase kurulumu (backend)

Minito’nun kalbi **Supabase Edge Function** (`break-task`): kullanıcı girdisini alır, OpenAI/Gemini ile adımlara böler, sonucu döner.

### Adım 1 — Supabase projesi

1. [supabase.com](https://supabase.com) → yeni proje oluştur
2. **Settings → API** → Project URL ve **anon public** key’i kopyala → `.env`’e yaz

### Adım 2 — Veritabanı migration’ları

Supabase Dashboard → **SQL Editor** → sırayla çalıştır:

| Dosya | Ne yapar? |
|-------|-----------|
| `supabase/migrations/001_initial_schema.sql` | `system_prompts`, `tasks` tabloları |
| `supabase/migrations/002_i18n_translations.sql` | Çeviri tablosu |
| `supabase/migrations/003_add_steps_to_tasks.sql` | Görev adımları sütunu |
| `supabase/migrations/004_update_system_prompt_for_gemini.sql` | Gemini prompt güncellemesi |
| `supabase/migrations/005_update_system_prompt_neuro_prosthetic.sql` | Nöro-protez prompt |
| `supabase/migrations/006_update_system_prompt_neuro_companion.sql` | Nöro-yoldaş prompt (güncel) |

### Adım 3 — Edge Function deploy

```bash
# Supabase CLI (npx ile kurulum gerektirmez)
npx supabase login
npx supabase link --project-ref XXXXXXXXXXXXX

# Fonksiyonları deploy et
npx supabase functions deploy break-task
npx supabase functions deploy delete-user
npx supabase functions deploy export-user-data
```

### Adım 4 — Edge Function ortam değişkenleri

Supabase Dashboard → **Edge Functions → break-task → Settings**:

| Değişken | Açıklama |
|----------|----------|
| `OPENAI_API_KEY` | OpenAI API anahtarın |
| `HMAC_SECRET` | Gizlilik hash’i için (`openssl rand -hex 32`) |
| `SUPABASE_URL` | Otomatik gelir |
| `SUPABASE_SERVICE_ROLE_KEY` | Otomatik gelir |

> Detaylı Türkçe rehber: [`docs/SUPABASE_KURULUM_REHBERI.md`](./docs/SUPABASE_KURULUM_REHBERI.md)  
> İngilizce rehber: [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md)

---

## Uygulamayı çalıştırma

### Geliştirme modu

```bash
npm start              # Expo dev server
npm start -- --clear   # Cache temizleyerek başlat (sorun olursa dene)
npm run android        # Doğrudan Android
npm run ios            # Doğrudan iOS
npm run web            # Web tarayıcı
```

### Production build (EAS)

```bash
# EAS CLI kur (bir kez)
npm install -g eas-cli
eas login

# Preview APK (Android)
eas build --profile preview --platform android

# Production
eas build --profile production --platform all
```

Build profilleri `eas.json` dosyasında tanımlı.

---

## Uygulamayı kullanma (ekran rehberi)

### Ana ekran (`app/index.tsx`)

- Ortadaki metin kutusuna bunaltıcı görevini yaz (ör. “Mutfağı temizle”)
- **Minito'la!** butonuna bas → AI adımları üretir
- Sağ üstte kullanıcı widget’ı; sol altta **Dashboard** menüsü
- Yarım kalan oturum varsa **“Kaldığın yerden devam et”** banner’ı çıkar
- İnternet yoksa üstte turuncu **Offline Banner** görünür (fallback adımlar kullanılır)

### Dashboard (modal)

Ana ekrandan açılan merkezi menü. Kısayollar:

| Kart | Ekran | Ne yapar? |
|------|-------|-----------|
| **Planlayıcı** | `/planner` | Projeler ve alt görevler |
| **Sesler** | `/sounds` | Odak ambiyansı (kahverengi gürültü, yağmur vb.) |
| **İstatistikler** | `/stats` | Tamamlanan oturumlardan gerçek analitik |
| **Ayarlar** | `/settings` | Bildirim, dil, ses tercihleri |
| **Giriş** | `/login` | Apple / Google / Misafir |
| **Gizlilik** | `/privacy` | GDPR veri dışa aktarma, hesap silme |

### Odak modu (`app/focus.tsx`)

AI’dan gelen adımların tek tek tamamlandığı tam ekran mod.

1. **Empati ekranı** — AI’ın empati köprüsü + ilk adım kancası
2. **Adım adım ilerleme** — Her adımda “YAPTIM” butonu
3. **Zamanlayıcı** — Adımda süre varsa (`InlineTimer`) otomatik başlar
4. **Animasyonlar** — Adım tamamlanınca kutlama, oturum bitince konfeti
5. **Oturum kaydı** — İlerleme cihazda saklanır; uygulama kapanırsa geri yüklenir

### Başarı ekranı (`app/success.tsx`)

Tüm adımlar tamamlanınca açılır. Rastgele motivasyon mesajı + tamamlanan adım sayısı.

### Planlayıcı (`app/planner.tsx`)

- Proje oluştur (renk seç, son tarih ekle)
- Manuel alt görev ekle veya **AI ile alt görev üret**
- Görevleri tamamla / sil
- Veriler **cihazda kalıcı** (`AsyncStorage` üzerinden `ProjectContext`)

### İstatistikler (`app/stats.tsx`)

Gerçek odak oturumlarından hesaplanan grafikler:

- **Flow State Visualizer** — Akış durumu
- **Focus Equalizer** — Saatlik odak dağılımı
- **Silent Heatmap** — Günlük aktivite ısı haritası
- **Energy Flow Bars** — Proje bazlı enerji

> Henüz oturum tamamlamadıysan ekran boş görünür — bu normal.

### Sesler (`app/sounds.tsx`)

Odak ambiyansı seç: Brown Noise, White Noise, Yağmur, Orman.  
Sağ alttaki **yüzen ses butonu** (`FloatingAudioButton`) tüm ekranlarda görünür.

### Panik kiti (`app/panic.tsx`)

AI moderasyonu tehlikeli içerik tespit ederse açılır. Sakinleştirici adımlar (nefes, grounding, destek). **Reklam yok** — tasarım kuralı.

### Giriş (`app/login.tsx`)

- Apple ile devam et
- Google ile devam et
- Misafir olarak devam et (hesap gerekmez)

OAuth kurulumu: [`docs/OAUTH_SETUP.md`](./docs/OAUTH_SETUP.md)

### Gizlilik (`app/privacy.tsx`)

- Verilerini dışa aktar (GDPR)
- Hesabı kalıcı sil
- Gizlilik politikası özeti

---

## Proje yapısı

```
minito/
├── app/                    # Expo Router ekranları (dosya = rota)
│   ├── _layout.tsx         # Kök layout, provider'lar, global arka plan
│   ├── index.tsx           # Ana ekran (görev girişi)
│   ├── focus.tsx           # Odak modu
│   ├── success.tsx         # Tamamlama ekranı
│   ├── panic.tsx           # Panik / güvenlik ekranı
│   ├── planner.tsx         # Proje planlayıcı
│   ├── stats.tsx           # Analitik
│   ├── sounds.tsx          # Ambiyans sesleri
│   ├── settings.tsx        # Ayarlar
│   ├── login.tsx           # OAuth giriş
│   └── privacy.tsx         # GDPR / gizlilik
│
├── src/
│   ├── components/         # UI bileşenleri
│   │   ├── analytics/      # Grafik / görselleştirme bileşenleri
│   │   ├── audio/          # Yüzen ses butonu
│   │   ├── gamification/   # Streak, oturum özeti
│   │   ├── planner/        # Proje kartları
│   │   ├── TaskInput.tsx   # Ana görev giriş alanı
│   │   ├── FocusCard.tsx   # Odak modu adım kartı
│   │   ├── AuroraBackground.tsx  # Animasyonlu arka plan
│   │   └── ...
│   │
│   ├── context/            # React Context (global state)
│   │   ├── AudioContext.tsx      # Ses oynatma
│   │   └── ProjectContext.tsx    # Planlayıcı projeleri
│   │
│   ├── lib/                # İş mantığı ve yardımcılar
│   │   ├── api/            # breakTask, userData API çağrıları
│   │   ├── auth/           # Apple / Google OAuth
│   │   ├── i18n/           # Çoklu dil (TR / EN)
│   │   ├── stats/          # Oturum istatistik deposu
│   │   ├── storage/        # AsyncStorage sarmalayıcıları
│   │   ├── supabase/       # Supabase client
│   │   └── offlineFallback.ts  # Çevrimdışı yedek adımlar
│   │
│   ├── modals/             # Modal ekranlar
│   │   ├── DashboardModal.tsx
│   │   ├── FocusMode.tsx
│   │   └── SessionCompletionModal.tsx
│   │
│   └── safety/             # Panik kiti, fallback nedenleri
│
├── supabase/
│   ├── migrations/         # SQL migration dosyaları
│   └── functions/
│       ├── break-task/     # ⭐ Ana AI edge function
│       ├── delete-user/    # Hesap silme (GDPR)
│       └── export-user-data/  # Veri dışa aktarma (GDPR)
│
├── docs/                   # Ek kurulum rehberleri
├── assets/                 # İkon, splash, ses dosyaları
├── app.json                # Expo yapılandırması
├── eas.json                # EAS build profilleri
├── tailwind.config.js      # NativeWind / Tailwind renkleri
└── package.json
```

### Önemli dosyalar — hızlı referans

| Dosya | Rol |
|-------|-----|
| `app/index.tsx` | Kullanıcının görev yazdığı ana ekran |
| `app/focus.tsx` | Adım adım odak akışı |
| `src/lib/api/breakTask.ts` | Frontend → Edge Function köprüsü |
| `supabase/functions/break-task/index.ts` | AI prompt, moderasyon, OpenAI/Gemini çağrısı |
| `src/context/ProjectContext.tsx` | Planlayıcı verisi + kalıcılık |
| `src/lib/storage/activeSessionStore.ts` | Yarım kalan odak oturumu |
| `src/lib/stats/sessionStore.ts` | Tamamlanan oturum kayıtları |
| `src/lib/i18n/locales/tr.json` | Türkçe metinler |
| `src/lib/i18n/locales/en.json` | İngilizce metinler |

---

## Teknoloji yığını

| Katman | Teknoloji |
|--------|-----------|
| **Framework** | [Expo SDK 54](https://expo.dev) + [React Native 0.81](https://reactnative.dev) |
| **Routing** | [Expo Router 6](https://docs.expo.dev/router/introduction/) (file-based) |
| **Stil** | [NativeWind 4](https://www.nativewind.dev) (Tailwind CSS) |
| **Animasyon** | React Native Reanimated, Lottie, Skia |
| **Backend** | [Supabase](https://supabase.com) (PostgreSQL + Edge Functions) |
| **AI** | OpenAI GPT-4o-mini (+ Gemini fallback) |
| **Auth** | Supabase Auth + Apple / Google OAuth |
| **i18n** | i18next + react-i18next |
| **Hata izleme** | Sentry |
| **Reklam** | Google AdMob (test ID’leri şu an `app.json`’da) |
| **Dil** | TypeScript |

---

## Mimari ve veri akışı

```
┌─────────────────┐     HTTPS      ┌──────────────────────────┐
│  React Native   │ ──────────────▶│  Supabase Edge Function  │
│  (Expo app)     │                │  break-task                │
│                 │◀──────────────│  • Moderasyon             │
│  app/index.tsx  │   JSON steps   │  • OpenAI / Gemini        │
│  breakTask.ts   │                │  • Hash + kayıt           │
└────────┬────────┘                └────────────┬─────────────┘
         │                                      │
         │ AsyncStorage                         │ PostgreSQL
         ▼                                      ▼
┌─────────────────┐                ┌──────────────────────────┐
│ Cihaz depolama  │                │  tasks (hash only)       │
│ • Aktif oturum  │                │  system_prompts          │
│ • Projeler      │                │  i18n_translations       │
│ • İstatistikler │                └──────────────────────────┘
└─────────────────┘
```

### Gizlilik modeli

- Kullanıcı girdisi sunucuda **düz metin olarak saklanmaz**
- `input_hash = HMAC_SHA256(secret, sanitized_input)` kaydedilir
- GDPR: `export-user-data` ve `delete-user` edge function’ları mevcut
- Misafir kullanıcılar için `guest_id` (UUID) cihazda `SecureStore`’da tutulur

### Fail-soft felsefesi

AI, ağ veya moderasyon hata verirse uygulama **asla çökmez**:

| Durum | Davranış |
|-------|----------|
| AI yanıt vermiyor | Yerel fallback adımlar |
| İnternet yok | Offline banner + fallback |
| Tehlikeli içerik | Panik kiti ekranı |
| Supabase yapılandırılmamış | Offline mod, uyarı log’u |

---

## Geliştirme ipuçları

### Cache sorunları

```bash
npm start -- --clear
```

### TypeScript kontrol

```bash
npx tsc --noEmit
```

### Dev seed verisi

`ProjectContext` geliştirme modunda (`__DEV__`) ilk açılışta örnek projeler seed eder. Release build’de **asla** çalışmaz.

### Yeni ekran ekleme

1. `app/yeni-ekran.tsx` oluştur → otomatik rota `/yeni-ekran`
2. Gerekirse `app/_layout.tsx` içindeki `Stack.Screen` listesine ekle
3. Metinler için `src/lib/i18n/locales/tr.json` ve `en.json` güncelle

### Yeni çeviri ekleme

```json
// src/lib/i18n/locales/tr.json
"myFeature": {
  "title": "Başlık"
}
```

```tsx
// Bileşende
const { t } = useTranslation();
<Text>{t('myFeature.title')}</Text>
```

### Tema renkleri

`tailwind.config.js` → `background: #050510`, `primary: #8B5CF6` (neon mor)

---

## Ek dokümantasyon

| Dosya | İçerik |
|-------|--------|
| [`docs/SUPABASE_KURULUM_REHBERI.md`](./docs/SUPABASE_KURULUM_REHBERI.md) | Türkçe adım adım Supabase kurulumu |
| [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md) | İngilizce Supabase rehberi |
| [`docs/OAUTH_SETUP.md`](./docs/OAUTH_SETUP.md) | Apple / Google OAuth kurulumu |
| [`supabase/README.md`](./supabase/README.md) | Edge Function deploy özeti |
| [`supabase/functions/break-task/README.md`](./supabase/functions/break-task/README.md) | break-task API detayları |

---

## SSS (Sık Sorulan Sorular)

### Uygulama Supabase olmadan çalışır mı?

Evet, **sınırlı modda**. Ana ekran açılır; AI yerine yerel fallback adımlar kullanılır. Tam deneyim için Supabase + Edge Function + OpenAI key gerekir.

### `.env` dosyasını nereden alacağım?

Projede `.env` Git’e dahil değil (güvenlik). Repo sahibinden değerleri iste veya kendi Supabase projeni kurup [`Ortam değişkenleri`](#ortam-değişkenleri-env) bölümündeki şablonu doldur.

### Telefonda nasıl test ederim?

1. Bilgisayarda `npm start`
2. Telefona **Expo Go** indir (App Store / Play Store)
3. Aynı Wi‑Fi ağında QR kodu okut

Bağlantı sorunu olursa terminalde `tunnel` modunu dene: `npx expo start --tunnel`

### AI yavaş veya yanıt vermiyor

- Edge Function deploy edildi mi? (`npx supabase functions deploy break-task`)
- `OPENAI_API_KEY` Edge Function env’de tanımlı mı?
- Supabase projesi pause edilmiş olabilir — Dashboard’dan kontrol et
- 20–40 sn bekliyorsa OpenAI rate limit veya ağ sorunu olabilir; uygulama sonunda fallback’e düşer

### “Minito'luyor…” takılı kalıyor

`.env` değerlerini kontrol et. Terminal / Metro log’larına bak. Cache temizle: `npm start -- --clear`

### Misafir modu ile giriş yapmanın farkı nedir?

Misafir modda hesap yok; veriler cihazda kalır. Giriş yapınca Supabase Auth oturumu açılır; ileride cihazlar arası senkronizasyon mümkün olur (henüz tam senkron yok).

### Planlayıcı verileri nerede saklanıyor?

Cihazda — `AsyncStorage` (`src/lib/storage/jsonStore.ts` → `ProjectContext`). Sunucuya gitmez.

### İstatistikler neden boş?

İstatistikler **gerçek tamamlanan odak oturumlarından** hesaplanır. En az bir görevi odak modunda baştan sona tamamla; sonra `/stats` ekranına git.

### Sesler çalmıyor

Ses track tanımları var (`AudioContext`) ama bazı ses dosyaları henüz `assets/`’e eklenmemiş olabilir. UI çalışır; gerçek audio asset bağlandığında oynatma aktif olur.

### Reklamlar gerçek mi?

`app.json` şu an Google’ın **test AdMob ID’lerini** kullanıyor. Production’a geçmeden gerçek publisher ID’leri ile değiştirmen gerekir.

### Hangi Node sürümünü kullanmalıyım?

Node 18 veya 20 önerilir. `node -v` ile kontrol et.

### Windows’ta Supabase CLI nasıl kurulur?

Global npm kurulumu artık desteklenmiyor. **`npx supabase`** kullan (kurulum gerektirmez) veya Scoop ile kur.

### Projeye nasıl katkı veririm?

1. Feature branch aç: `git checkout -b feature/aciklama`
2. Değişiklikleri yap, test et
3. Pull request aç

`.env`, API key’ler ve `node_modules` commit etme.

---

## Bilinen sınırlamalar

| Konu | Durum |
|------|-------|
| AdMob ID’leri | Test ID’leri — production öncesi değiştirilmeli |
| Ses asset’leri | UI hazır, bazı dosyalar eksik olabilir |
| OAuth | Google / Apple için ayrı Cloud / Developer kurulumu gerekir |
| Rate limiting | Edge Function’da uyarı log’u var, sert limit henüz yok |
| Sadece karanlık mod | Açık tema yok (`app.json`: `userInterfaceStyle: "dark"`) |
| Web desteği | Var ama mobil deneyim birincil hedef |

---

## Lisans ve katkı

Bu proje şu an **private** (`package.json`: `"private": true`).

Soruların için repo sahibine ulaş veya issue aç.

---

<p align="center">
  <strong>Minito</strong> — Büyük görevleri küçük adımlara böl. Başlamak için aptalca kolay bir adım yeter.
</p>
