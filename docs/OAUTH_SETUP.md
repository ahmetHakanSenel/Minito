# OAuth Provider Setup Guide

Bu rehber, Minito uygulaması için Apple ve Google OAuth provider'larını yapılandırmanız için adım adım talimatlar içerir.

## 📋 Genel Bakış

1. **Google OAuth Setup** - Google Cloud Console ve Supabase
2. **Apple OAuth Setup** - Apple Developer ve Supabase
3. **Environment Variables** - .env dosyası yapılandırması

---

## 🔵 Google OAuth Setup

### Adım 1: Google Cloud Console'da Proje Oluşturma

1. [Google Cloud Console](https://console.cloud.google.com/) adresine gidin
2. Üst menüden **"Select a project"** → **"New Project"** tıklayın
3. Proje adını girin (örn: `minito-app`)
4. **"Create"** butonuna tıklayın
5. Oluşturulan projeyi seçin

### Adım 2: OAuth Consent Screen Yapılandırma

1. Sol menüden **"APIs & Services"** → **"OAuth consent screen"** seçin
2. **User Type** seçin:
   - **External** (genel kullanım için)
   - **Internal** (sadece Google Workspace için)
3. **"Create"** butonuna tıklayın
4. **App information** doldurun:
   - **App name**: `Minito`
   - **User support email**: Kendi email adresiniz
   - **App logo**: (Opsiyonel) Logo yükleyin
   - **Application home page**: (Opsiyonel) Website URL
   - **Application privacy policy link**: (Opsiyonel) Privacy policy URL
   - **Application terms of service link**: (Opsiyonel) Terms URL
   - **Authorized domains**: (Boş bırakabilirsiniz)
   - **Developer contact information**: Email adresiniz
5. **"Save and Continue"** tıklayın
6. **Scopes** sayfasında **"Add or Remove Scopes"** tıklayın
   - `userinfo.email` seçin
   - `userinfo.profile` seçin
   - **"Update"** tıklayın
7. **"Save and Continue"** tıklayın
8. **Test users** sayfasında (External seçtiyseniz):
   - Test için kullanmak istediğiniz email adreslerini ekleyin
   - **"Save and Continue"** tıklayın
9. **Summary** sayfasını kontrol edip **"Back to Dashboard"** tıklayın

### Adım 3: OAuth 2.0 Client ID Oluşturma

1. Sol menüden **"APIs & Services"** → **"Credentials"** seçin
2. Üstte **"+ CREATE CREDENTIALS"** → **"OAuth client ID"** seçin
3. **Application type** seçin:
   - **Web application** (Supabase için gerekli)
4. **Name**: `Minito Web Client` girin
5. **Authorized JavaScript origins** ekleyin:
   ```
   https://hpajqdeebmwhomtyyyoe.supabase.co/auth/v1/callback
   ```
   Örnek: `https://abcdefghijklmnop.supabase.co`
6. **Authorized redirect URIs** ekleyin:
   ```
   https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
   ```
   Örnek: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`
7. **"Create"** butonuna tıklayın
8. **Client ID** ve **Client secret** değerlerini kopyalayın (bir daha gösterilmeyecek!)
   - Bu değerleri güvenli bir yere kaydedin

### Adım 4: Supabase Dashboard'da Google Provider Ekleme

1. [Supabase Dashboard](https://app.supabase.com/) adresine gidin
2. Projenizi seçin
3. Sol menüden **"Authentication"** → **"Providers"** seçin
4. **"Google"** provider'ını bulun ve **"Enable"** butonuna tıklayın
5. Açılan formu doldurun:
   - **Client ID (for OAuth)**: Google Cloud Console'dan kopyaladığınız Client ID
   - **Client Secret (for OAuth)**: Google Cloud Console'dan kopyaladığınız Client Secret
6. **"Save"** butonuna tıklayın

### Adım 5: .env Dosyasına Google Web Client ID Ekleme

1. Proje root dizininde `.env` dosyasını açın (yoksa oluşturun)
2. Şu satırı ekleyin:
   ```env
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_BURAYA
   ```
   Örnek:
   ```env
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
   https://hpajqdeebmwhomtyyyoe.supabase.co/auth/v1/callback
   ```
3. Dosyayı kaydedin

---

## 🍎 Apple OAuth Setup

### Ön Gereksinimler

- **Apple Developer Account** gerekli (yıllık $99)
- Apple Developer Program üyeliği aktif olmalı

### Adım 1: Apple Developer Console'da Service ID Oluşturma

1. [Apple Developer Portal](https://developer.apple.com/account/) adresine gidin
2. **"Certificates, Identifiers & Profiles"** seçin
3. Sol menüden **"Identifiers"** → **"+"** butonuna tıklayın
4. **"Services IDs"** seçin → **"Continue"**
5. **Description**: `Minito OAuth` girin
6. **Identifier**: `com.yourcompany.minito.oauth` formatında bir ID girin
7. **"Continue"** → **"Register"** tıklayın
8. Oluşturulan Service ID'yi seçin
9. **"Sign in with Apple"** seçeneğini işaretleyin → **"Configure"**
10. **Primary App ID** seçin (veya yeni bir App ID oluşturun)
11. **Website URLs** bölümünü doldurun:
    - **Domains and Subdomains**: `[YOUR-PROJECT-REF].supabase.co`
    - **Return URLs**: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
    Örnek:
    - Domain: `abcdefghijklmnop.supabase.co`
    - Return URL: `https://abcdefghijklmnop.supabase.co/auth/v1/callback`
12. **"Next"** → **"Done"** → **"Continue"** → **"Save"** tıklayın

### Adım 2: Apple Key Oluşturma

1. Apple Developer Portal'da **"Keys"** → **"+"** butonuna tıklayın
2. **Key Name**: `Minito Sign in with Apple Key` girin
3. **"Sign in with Apple"** seçeneğini işaretleyin → **"Configure"**
4. **Primary App ID** seçin → **"Save"** → **"Continue"** → **"Register"**
5. **Key** oluşturulduktan sonra **"Download"** butonuna tıklayın
   - ⚠️ **ÖNEMLİ**: Bu `.p8` dosyasını sadece bir kez indirebilirsiniz!
   - Dosyayı güvenli bir yere kaydedin
6. **Key ID**'yi not edin (daha sonra kullanılacak)

### Adım 3: Supabase Dashboard'da Apple Provider Ekleme

1. Supabase Dashboard'da **"Authentication"** → **"Providers"** seçin
2. **"Apple"** provider'ını bulun ve **"Enable"** butonuna tıklayın
3. Açılan formu doldurun:
   - **Services ID**: Apple Developer Portal'dan oluşturduğunuz Service ID
   - **Secret Key**: İndirdiğiniz `.p8` dosyasının içeriğini açıp kopyalayın
   - **Key ID**: Apple Developer Portal'dan not ettiğiniz Key ID
   - **Team ID**: Apple Developer Portal'ın sağ üst köşesindeki Team ID (10 karakterlik)
4. **"Save"** butonuna tıklayın

---

## 🔐 Environment Variables (.env) Yapılandırması

### .env Dosyası Örneği

Proje root dizininde `.env` dosyası oluşturun veya mevcut dosyayı güncelleyin:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL=https://[YOUR-PROJECT-REF].supabase.co/functions/v1/break-task

# Google OAuth (Web Client ID)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# OpenAI (Edge Function'da kullanılır)
OPENAI_API_KEY=your-openai-api-key

# Supabase Service Role Key (Edge Function'da kullanılır)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# HMAC Secret (Edge Function'da kullanılır)
HMAC_SECRET=your-hmac-secret

# Sentry (Opsiyonel)
SENTRY_DSN=your-sentry-dsn
```

### Önemli Notlar

1. **.env dosyası .gitignore'da olmalı** - Asla Git'e commit etmeyin!
2. **EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID** - Google OAuth için Web Client ID kullanılır (Mobile Client ID değil!)
3. Tüm `EXPO_PUBLIC_*` değişkenleri React Native'de erişilebilir olur
4. Diğer değişkenler sadece server-side (Edge Functions) kullanılır

---

## ✅ Test Etme

### Google Sign In Test

1. Uygulamayı çalıştırın: `npm start`
2. Login ekranına gidin
3. **"Continue with Google"** butonuna tıklayın
4. Google hesabınızla giriş yapın
5. Başarılı olursa ana ekrana yönlendirilmelisiniz

### Apple Sign In Test (iOS Only)

1. iOS cihazda veya simulator'da uygulamayı çalıştırın
2. Login ekranına gidin
3. **"Continue with Apple"** butonuna tıklayın
4. Apple ID'nizle giriş yapın
5. Başarılı olursa ana ekrana yönlendirilmelisiniz

---

## 🐛 Sorun Giderme

### Google Sign In Çalışmıyor

- ✅ Google Cloud Console'da OAuth consent screen'in "Published" olduğundan emin olun (test modunda sadece test kullanıcıları giriş yapabilir)
- ✅ Redirect URI'nin doğru olduğundan emin olun
- ✅ Client ID ve Secret'ın doğru kopyalandığından emin olun
- ✅ Supabase Dashboard'da Google provider'ın "Enabled" olduğundan emin olun

### Apple Sign In Çalışmıyor

- ✅ Apple Developer Account'unuzun aktif olduğundan emin olun
- ✅ Service ID'nin doğru yapılandırıldığından emin olun
- ✅ Return URL'in doğru olduğundan emin olun
- ✅ Key ID, Team ID ve Secret Key'in doğru olduğundan emin olun
- ✅ iOS cihazda test edin (simulator'da çalışmayabilir)

### Environment Variables Çalışmıyor

- ✅ `.env` dosyasının proje root dizininde olduğundan emin olun
- ✅ Değişken isimlerinin `EXPO_PUBLIC_` ile başladığından emin olun
- ✅ Uygulamayı yeniden başlatın (`npm start --clear`)
- ✅ Metro bundler'ı temizleyin: `npx expo start --clear`

---

## 📚 Ek Kaynaklar

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Apple Sign In Setup Guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Expo Auth Session](https://docs.expo.dev/guides/authentication/#google)

---

## 🔒 Güvenlik Uyarıları

1. **Asla credentials'ları Git'e commit etmeyin**
2. **.env dosyasını .gitignore'a ekleyin**
3. **Production'da farklı OAuth credentials kullanın**
4. **Client Secret'ları sadece server-side kullanın**
5. **Apple Key (.p8) dosyasını güvenli bir yerde saklayın**















