# Supabase Setup Guide

Bu rehber, Minito uygulaması için Supabase projesi oluşturma ve gerekli bilgileri alma adımlarını içerir.

## 📋 Adımlar

### 1. Supabase Hesabı Oluşturma

1. [Supabase](https://supabase.com/) adresine gidin
2. **"Start your project"** veya **"Sign Up"** butonuna tıklayın
3. GitHub, GitLab veya Email ile kayıt olun
4. Email doğrulamasını tamamlayın

### 2. Yeni Proje Oluşturma

1. Supabase Dashboard'a giriş yaptıktan sonra **"New Project"** butonuna tıklayın
2. **Organization** seçin (yoksa yeni bir organization oluşturun)
3. Proje bilgilerini doldurun:
   - **Name**: `minito` (veya istediğiniz isim)
   - **Database Password**: Güçlü bir şifre oluşturun (kaydedin!)
   - **Region**: Size en yakın bölgeyi seçin (örn: `West US`, `Europe West`)
   - **Pricing Plan**: Free tier ile başlayabilirsiniz
4. **"Create new project"** butonuna tıklayın
5. Proje oluşturulmasını bekleyin (2-3 dakika sürebilir)

### 3. API Keys (Anon Key) Alma

1. Proje oluşturulduktan sonra, sol menüden **"Settings"** (⚙️) seçin
2. **"API"** sekmesine tıklayın
3. **"Project API keys"** bölümünde şunları göreceksiniz:

#### 🔑 Anon Key (Public Key)
- **anon** `public` - Bu key'i kullanacağız
- Bu key'i kopyalayın (güvenli bir yere kaydedin)
- Bu key frontend'de kullanılır ve public'tir (güvenli)

#### 🔐 Service Role Key (Secret Key)
- **service_role** `secret` - Bu key'i **ASLA** frontend'de kullanmayın!
- Bu key sadece backend/Edge Functions'da kullanılır
- Bu key'e sahip olan herkes veritabanınızı tamamen kontrol edebilir

### 4. Project URL Alma

1. Aynı **"API"** sayfasında, **"Project URL"** bölümünü bulun
2. URL şu formatta olacak: `https://xxxxxxxxxxxxx.supabase.co`
3. Bu URL'i kopyalayın

### 5. .env Dosyasına Ekleme

1. Proje root dizininde `.env` dosyası oluşturun (yoksa)
2. Şu bilgileri ekleyin:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTIwMDAwMCwiZXhwIjoxOTYwNzg2MDAwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Edge Function URL (opsiyonel, otomatik oluşturulabilir)
EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL=https://xxxxxxxxxxxxx.supabase.co/functions/v1/break-task
```

**ÖNEMLİ:**
- `.env` dosyası `.gitignore`'da olmalı (zaten ekli)
- Bu bilgileri **ASLA** Git'e commit etmeyin
- Anon key public'tir ama yine de güvenli tutun

### 6. Database Schema'yı Oluşturma

1. Supabase Dashboard'da sol menüden **"SQL Editor"** seçin
2. **"New query"** butonuna tıklayın
3. `supabase/migrations/001_initial_schema.sql` dosyasının içeriğini kopyalayın
4. SQL Editor'e yapıştırın
5. **"Run"** butonuna tıklayın (veya `Ctrl+Enter`)
6. Başarılı olduğunu doğrulayın

### 7. i18n Translations Tablosunu Oluşturma (Opsiyonel)

1. Aynı **"SQL Editor"**'de
2. `supabase/migrations/002_i18n_translations.sql` dosyasının içeriğini kopyalayın
3. SQL Editor'e yapıştırın
4. **"Run"** butonuna tıklayın

### 8. İlk System Prompt'u Ekleme

1. **"SQL Editor"**'de yeni bir query oluşturun
2. Şu SQL'i çalıştırın:

```sql
INSERT INTO system_prompts (prompt_text, is_active) 
VALUES (
  'You are a helpful assistant that breaks down tasks into clear, actionable steps. Return only a JSON array of step strings, no other text. Each step should be concise and actionable. Example: ["Step 1 description", "Step 2 description", "Step 3 description"]',
  true
);
```

3. **"Run"** butonuna tıklayın

### 9. Edge Functions Deploy Etme

1. Terminal'de Supabase CLI'yi yükleyin (yoksa):
   ```bash
   npm install -g supabase
   ```

2. Supabase'e login olun:
   ```bash
   supabase login
   ```

3. Projenizi link edin:
   ```bash
   supabase link --project-ref xxxxxxxxxxxxx
   ```
   (Project ref'i Dashboard → Settings → General → Reference ID'den bulabilirsiniz)

4. Edge Function'ları deploy edin:
   ```bash
   supabase functions deploy break-task
   supabase functions deploy delete-user
   supabase functions deploy export-user-data
   ```

5. Edge Function environment variables'ları ayarlayın:
   - Dashboard → Edge Functions → break-task → Settings
   - Şu değişkenleri ekleyin:
     - `OPENAI_API_KEY`: OpenAI API key'iniz
     - `HMAC_SECRET`: Güçlü bir secret (oluşturmak için: `openssl rand -hex 32`)
     - `SUPABASE_URL`: Otomatik set edilir
     - `SUPABASE_SERVICE_ROLE_KEY`: Otomatik set edilir

### 10. Test Etme

1. Uygulamayı başlatın:
   ```bash
   npm start
   ```

2. Bir görev girin ve test edin
3. Supabase Dashboard → **"Table Editor"** → **"tasks"** tablosunda kayıtları kontrol edin

## 🔒 Güvenlik Notları

1. **Anon Key (Public Key)**:
   - Frontend'de kullanılabilir
   - Row Level Security (RLS) ile korunmalı
   - Public'tir ama yine de güvenli tutun

2. **Service Role Key (Secret Key)**:
   - **ASLA** frontend'de kullanmayın!
   - Sadece backend/Edge Functions'da kullanın
   - Bu key'e sahip olan herkes veritabanınızı tamamen kontrol edebilir

3. **Environment Variables**:
   - `.env` dosyasını `.gitignore`'a ekleyin (zaten ekli)
   - Production'da farklı keys kullanın
   - Keys'leri düzenli olarak rotate edin

## 📚 Ek Kaynaklar

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Dashboard](https://app.supabase.com/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## 🐛 Sorun Giderme

### "supabaseUrl is required" Hatası
- `.env` dosyasının proje root dizininde olduğundan emin olun
- `EXPO_PUBLIC_SUPABASE_URL` değişkeninin doğru olduğundan emin olun
- Uygulamayı yeniden başlatın: `npm start --clear`

### "Invalid API key" Hatası
- Anon key'in doğru kopyalandığından emin olun
- Key'in başında/sonunda boşluk olmadığından emin olun
- Supabase Dashboard'dan key'i tekrar kopyalayın

### Database Connection Hatası
- Supabase projenizin aktif olduğundan emin olun
- Project URL'in doğru olduğundan emin olun
- Network bağlantınızı kontrol edin















