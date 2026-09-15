# 🚀 Supabase Kurulum Rehberi - Adım Adım

Bu rehber, resume edilmiş Supabase projenizi sıfırdan kurmak için gereken tüm adımları içerir.

---

## 📋 ADIM 1: Supabase Dashboard'a Giriş

1. [Supabase Dashboard](https://app.supabase.com/) adresine gidin
2. Resume edilmiş projenizi seçin veya yeni bir proje oluşturun
3. Projenizin **aktif** olduğundan emin olun (pause edilmişse resume edin)

---

## 🔑 ADIM 2: API Keys ve URL'leri Alma

1. Sol menüden **Settings** (⚙️) → **API** sekmesine gidin
2. **Project URL**'i kopyalayın (örn: `https://xxxxxxxxxxxxx.supabase.co`)
3. **Project API keys** bölümünden **anon** `public` key'i kopyalayın
4. Bu bilgileri güvenli bir yere kaydedin (notepad'e yazabilirsiniz)

**ÖNEMLİ:** `service_role` key'ini **ASLA** frontend'de kullanmayın!

---

## 📝 ADIM 3: .env Dosyası Oluşturma

Proje root dizininde (minito klasöründe) `.env` dosyası oluşturun ve şu içeriği ekleyin:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTIwMDAwMCwiZXhwIjoxOTYwNzg2MDAwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Edge Function URL (opsiyonel, sonra ekleyebilirsiniz)
EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL=https://xxxxxxxxxxxxx.supabase.co/functions/v1/break-task
```

**NOT:** `xxxxxxxxxxxxx` yerine kendi proje bilgilerinizi yazın!

---

## 🗄️ ADIM 4: Database Schema'yı Oluşturma

1. Supabase Dashboard'da sol menüden **SQL Editor** seçin
2. **New query** butonuna tıklayın
3. Aşağıdaki migration dosyalarını **sırayla** çalıştırın:

### 4.1. İlk Schema (001_initial_schema.sql)

`supabase/migrations/001_initial_schema.sql` dosyasının içeriğini kopyalayıp SQL Editor'e yapıştırın ve **Run** butonuna tıklayın.

### 4.2. i18n Translations (002_i18n_translations.sql)

`supabase/migrations/002_i18n_translations.sql` dosyasının içeriğini kopyalayıp SQL Editor'e yapıştırın ve **Run** butonuna tıklayın.

### 4.3. Steps Column Ekleme (003_add_steps_to_tasks.sql)

`supabase/migrations/003_add_steps_to_tasks.sql` dosyasının içeriğini kopyalayıp SQL Editor'e yapıştırın ve **Run** butonuna tıklayın.

---

## 🤖 ADIM 5: System Prompt'u Ekleme

SQL Editor'de yeni bir query oluşturun ve şu SQL'i çalıştırın:

```sql
-- En son system prompt'u ekle (Neuro-Cognitive Companion)
INSERT INTO system_prompts (prompt_text, is_active) 
VALUES (
  'You are Minito, a hyper-intelligent ''Neuro-Cognitive Companion'' designed for users with ADHD/Attention issues.

YOUR GOAL: Lower the ''activation energy'' required to start ANY task. You are not a todo-list generator. You are a cognitive unlocking partner.

═══════════════════════════════════════════════════════════════
RULES OF ENGAGEMENT (STRICT)
═══════════════════════════════════════════════════════════════

1. **NO ROBOT-SPEAK:**
   - NEVER say "Here is a list of steps" or "I can help with that" or "Sure!" or "Of course!"
   - Be concise, witty, and direct
   - Tone: 20% coach, 80% supportive friend who gets it
   - Use humor when appropriate - make the user smile

2. **THE ''MICRO-STEP'' RULE:**
   - NEVER give a step that takes more than 5-10 minutes
   - If you write "Clean the kitchen" → YOU FAILED
   - Correct: "Take 3 dirty cups to the sink"
   - Each step = ONE atomic physical or mental action

3. **DOPAMINE FIRST (The Hook):**
   - First step MUST be laughably easy
   - Examples: "Put on your favorite socks", "Open the laptop lid", "Stand up and stretch"
   - This creates an immediate ''win'' state and breaks paralysis

4. **CONTEXT AWARENESS:**
   - If user sounds stressed/overwhelmed → Be calm, reassuring, slow pace
   - If user sounds energetic/excited → Be fast, punchy, challenging
   - Match the emotional energy

5. **THE EMPATHY BRIDGE:**
   - Always acknowledge how hard the task FEELS (not just what it is)
   - Use relatable analogies
   - Make them feel seen, not judged

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON - STRICT)
═══════════════════════════════════════════════════════════════

You MUST output ONLY a raw JSON object with this EXACT schema:

{
  "empathy_bridge": "A 1-sentence acknowledgement of how hard this feels. Be specific and relatable. NOT generic sympathy.",
  "first_step_hook": "A specific, physical action to break paralysis. Must be stupidly easy. NOT the first step - this is the PRE-step.",
  "steps": [
    "Step 1 - The momentum builder",
    "Step 2 - Keep it rolling",
    "Step 3 - Small win",
    "...",
    "Final step - Dopamine reward / permission to stop"
  ],
  "language": "tr or en (match user''s language)"
}

═══════════════════════════════════════════════════════════════
LANGUAGE RULES
═══════════════════════════════════════════════════════════════

- Detect user''s language automatically
- Turkish input → Turkish output
- English input → English output
- Use natural, conversational language - NOT formal/corporate

═══════════════════════════════════════════════════════════════
CRITICAL REMINDERS
═══════════════════════════════════════════════════════════════

- Output ONLY valid JSON - no markdown, no comments, no explanations
- empathy_bridge: Make them feel SEEN, not pitied
- first_step_hook: This is the "break the seal" action - absurdly easy
- steps: 3-7 steps max, each one ATOMIC
- Final step: Always a mini-reward or "permission to stop"
- Match the user''s language and emotional tone',
  true
);
```

**Run** butonuna tıklayın.

---

## 🔧 ADIM 6: Supabase CLI Kurulumu (Edge Functions için)

**ÖNEMLİ:** Supabase CLI artık `npm install -g` ile kurulamıyor. Windows'ta şu yöntemlerden birini kullanın:

### Yöntem 1: Scoop ile Kurulum (Önerilen - En Kolay)

1. Eğer Scoop yüklü değilse, önce Scoop'u kurun:
   ```powershell
   # PowerShell'de (yönetici olarak) çalıştırın:
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   irm get.scoop.sh | iex
   ```

2. Supabase CLI'yi kurun:
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

### Yöntem 2: npx ile (Kurulum Gerektirmez - ÖNERİLEN ✅)

CLI'yi kurmak yerine, her komutta `npx` kullanabilirsiniz. Bu durumda ADIM 7-9'daki tüm `supabase` komutlarını `npx supabase` olarak değiştirin.

Örnek:
```bash
npx supabase login
npx supabase link --project-ref xxxxxxxxxxxxx
npx supabase functions deploy break-task
```

**Bu yöntem en kolay ve hızlıdır - kurulum gerektirmez!**

### Yöntem 3: Manuel Binary İndirme

CLI'yi kurmak yerine, her komutta `npx` kullanabilirsiniz. Bu durumda ADIM 7-9'daki tüm `supabase` komutlarını `npx supabase` olarak değiştirin.

Örnek:
```bash
npx supabase login
npx supabase link --project-ref xxxxxxxxxxxxx
npx supabase functions deploy break-task
```

### Yöntem 4: Manuel Binary İndirme

1. [Supabase CLI Releases](https://github.com/supabase/cli/releases) sayfasına gidin
2. En son Windows binary'sini indirin
3. İndirdiğiniz dosyayı PATH'e ekleyin

**Hangi yöntemi seçmeliyim?**
- **En kolay ve hızlı:** Yöntem 2 (npx - önerilen ✅) - Kurulum gerektirmez!
- **Kalıcı kurulum istiyorsanız:** Yöntem 1 (Scoop)
- **Manuel kontrol istiyorsanız:** Yöntem 3 (Binary indirme)

---

## 🔐 ADIM 7: Supabase'e Login Olma

Terminal'de şu komutu çalıştırın:

```bash
supabase login
```

Bu komut sizi tarayıcıda açacak ve Supabase hesabınıza giriş yapmanızı isteyecek.

---

## 🔗 ADIM 8: Projeyi Link Etme

Supabase Dashboard → Settings → General → **Reference ID**'yi kopyalayın.

Terminal'de şu komutu çalıştırın (xxxxxxxxxxxxx yerine Reference ID'nizi yazın):

```bash
supabase link --project-ref xxxxxxxxxxxxx
```

---

## 🚀 ADIM 9: Edge Functions Deploy Etme

Terminal'de şu komutları sırayla çalıştırın:

```bash
supabase functions deploy break-task
```

```bash
supabase functions deploy delete-user
```

```bash
supabase functions deploy export-user-data
```

---

## ⚙️ ADIM 10: Edge Function Environment Variables

1. Supabase Dashboard → **Edge Functions** → **break-task** → **Settings** sekmesine gidin
2. **Secrets** bölümüne şu environment variable'ları ekleyin:

   - `OPENAI_API_KEY`: OpenAI API key'iniz (eğer kullanıyorsanız)
   - `HMAC_SECRET`: Güçlü bir secret (oluşturmak için terminal'de: `openssl rand -hex 32`)

**NOT:** `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` otomatik olarak set edilir.

---

## ✅ ADIM 11: Test Etme

1. Uygulamayı yeniden başlatın (cache'i temizleyerek):

```bash
npm start -- --clear
```

2. Uygulamada bir görev girin ve test edin
3. Supabase Dashboard → **Table Editor** → **tasks** tablosunda kayıtları kontrol edin

---

## 🐛 Sorun Giderme

### "Çevrimdışısınız" Hatası

1. `.env` dosyasının proje root dizininde olduğundan emin olun
2. `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` değişkenlerinin doğru olduğundan emin olun
3. Supabase projenizin **aktif** olduğundan emin olun (pause edilmişse resume edin)
4. Uygulamayı cache temizleyerek yeniden başlatın: `npm start -- --clear`

### "Invalid API key" Hatası

1. Anon key'in doğru kopyalandığından emin olun
2. Key'in başında/sonunda boşluk olmadığından emin olun
3. Supabase Dashboard'dan key'i tekrar kopyalayın

### Database Connection Hatası

1. Supabase projenizin aktif olduğundan emin olun
2. Project URL'in doğru olduğundan emin olun
3. Network bağlantınızı kontrol edin

---

## 📚 Ek Notlar

- `.env` dosyası `.gitignore`'da olduğu için Git'e commit edilmeyecek (güvenli)
- Anon key public'tir ama yine de güvenli tutun
- Service Role key'i **ASLA** frontend'de kullanmayın!

---

## ✅ Kurulum Kontrol Listesi

- [ ] Supabase projesi aktif
- [ ] API URL ve Anon Key alındı
- [ ] `.env` dosyası oluşturuldu ve dolduruldu
- [ ] Database schema migration'ları çalıştırıldı (001, 002, 003)
- [ ] System prompt eklendi
- [ ] Supabase CLI kuruldu
- [ ] Supabase'e login olundu
- [ ] Proje link edildi
- [ ] Edge Functions deploy edildi
- [ ] Edge Function environment variables ayarlandı
- [ ] Uygulama test edildi ve çalışıyor

---

**Kurulum tamamlandı! 🎉**

