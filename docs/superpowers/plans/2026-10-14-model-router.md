# Model Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kodlama değişikliği isteklerini, boyut ve etki alanına göre Haiku/Sonnet/Opus/Fable alt ajanlarına otomatik devreden ve seçimi bildiren bir Claude Code plugin'i.

**Architecture:** Bir UserPromptSubmit hook'u (Node.js) override etiketlerini yakalar ve her istekte Claude'a `model-routing` skill'ini hatırlatan bağlam enjekte eder. Skill, hafif kod incelemesiyle seviyeyi seçer, kullanıcıya bildirir ve işi Agent aracının `model` parametresiyle alt ajana devreder.

**Tech Stack:** Node.js (yalnızca yerleşik modüller, `node:test`), Claude Code plugin sistemi (skill + hooks.json), Markdown.

**Spec:** `docs/superpowers/specs/2026-10-14-model-router-design.md`

## Global Constraints

- Plugin dizini: `model-router/` (repo kökünün altında). Plugin adı `model-router`; `claude-` veya `anthropic-` ile başlayamaz.
- Geçerli modeller ve override etiketleri: `haiku`, `sonnet`, `opus`, `fable` (`@haiku`, `@sonnet`, `@opus`, `@fable`).
- Hook stdin'inde istek metni `prompt` alanındadır. Çıktı: exit 0 + `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"..."}}`.
- Hook her koşulda exit 0 ile biter ve isteği asla bloklamaz; hata durumunda stdout'a hiçbir şey yazmaz.
- `additionalContext` olgu bildiren cümlelerle yazılır (emir kipi değil) ve 10.000 karakteri aşmaz.
- Hook yalnızca Node yerleşik modüllerini kullanır (bağımlılık yok).
- hooks.json: exec biçimi, `command: "node"`, `args: ["${CLAUDE_PLUGIN_ROOT}/hooks/route-hook.js"]`, üst düzey `"hooks"` sarmalayıcısı.
- Seviye eşlemesi: Haiku = tek dosya mekanik değişiklik; Sonnet = birkaç dosyalı normal özellik/hata düzeltme; Opus = çok dosyalı, modüller arası, refactor, zor hata ayıklama; Fable = mimari, büyük tasarım, çok yüksek riskli/belirsiz. Belirsizlikte bir üst seviye.
- Bildirim formatı: `→ <Model>'e yönlendirildi: <kısa gerekçe>`.
- `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` ayarlıysa çağrı başına model verilemez; skill yönlendirmeyi atlar ve kullanıcıya bildirir.

## Review Focus

- E-posta benzeri metin (`ali@opus.com`): override sayılmamalı.
- Birden fazla etiket (`@haiku ... @opus`): ilk etiket kazanır, hata verilmez.
- Büyük/küçük harf (`@OPUS`): override sayılır.
- Bilinmeyen etiket (`@gpt4`, `@opuss`): override sayılmaz, normal hatırlatma enjekte edilir.
- `prompt` alanı eksik, string değil veya stdin boş/bozuk JSON: sessizce çıktı yok, exit 0.
- Çok uzun istek (100.000 karakter): hook yine hızlı ve geçerli çıktı verir.
- Override içeren ama kodlama olmayan istek (`@haiku bu fonksiyon ne yapıyor?`): bağlam yine override bildirir; kararı skill uygular.

---

### Task 1: Plugin iskeleti ve manifest

**Files:**
- Create: `model-router/.claude-plugin/plugin.json`
- Create: `model-router/hooks/hooks.json`

**Interfaces:**
- Produces: `hooks/hooks.json` içinde `hooks/route-hook.js` yolunu çağıran UserPromptSubmit kaydı (Task 2 bu dosyayı oluşturur).

- [ ] **Step 1: `plugin.json` yaz.** Alanlar: `name: "model-router"`, `displayName: "Model Router"`, `version: "0.1.0"`, `description` (istek boyutuna göre Haiku/Sonnet/Opus/Fable alt ajanına yönlendirme), `author.name`, `license: "MIT"`, `keywords`.
- [ ] **Step 2: `hooks/hooks.json` yaz.** UserPromptSubmit için tek komut hook'u; exec biçimi (Global Constraints'teki değerler), `timeout: 10`.
- [ ] **Step 3: Doğrula.** Run: `claude plugin validate ./model-router`. Expected: `Validation passed` (route-hook.js henüz yoksa hooks.json'daki komut için uyarı dışında hata yok; uyarı varsa Task 2'den sonra tekrar çalıştırılacak).
- [ ] **Step 4: Commit** `git add model-router && git commit -m "feat: add plugin manifest and hook registration"`

### Task 2: Hook mantığı (override yakalama + bağlam)

**Files:**
- Create: `model-router/hooks/route-hook.js`
- Test: `model-router/hooks/route-hook.test.js`

**Interfaces:**
- Produces (module.exports, `route-hook.js`):
  - `detectOverride(prompt: unknown): 'haiku' | 'sonnet' | 'opus' | 'fable' | null`: yalnızca boşluk/satır başından sonra gelen `@<model>` etiketini, büyük/küçük harf duyarsız, ardından boşluk, noktalama veya satır sonu geliyorsa kabul eder. İlk geçerli etiket kazanır. String olmayan girdi için `null`.
  - `buildContext(override: string | null): string`: override varsa kullanıcının o modeli seçtiğini ve `model-routing` skill'inin sınıflandırma yapmadan işi bu modelle devretmesi gerektiğini bildiren; yoksa kodlama değişikliği isteklerinde `model-routing` skill'inin geçerli olduğunu bildiren, olgu cümleleriyle yazılmış metin döner.
  - `run(stdinText: string): string`: stdin metnini JSON olarak ayrıştırır, `prompt` alanından override'ı bulur ve hook çıktısının JSON dizesini döner; ayrıştırma hatasında veya `prompt` geçersizse boş string döner.
- Dosya doğrudan çalıştırıldığında (`require.main === module`) stdin'i okur, `run` çıktısı boş değilse stdout'a yazar ve her durumda `process.exit(0)`.

- [ ] **Step 1: Başarısız testleri yaz** (`node:test` + `node:assert`):
  - `detectOverride('@opus şunu yap')` → `'opus'`; `'@OPUS x'` → `'opus'`; `'lütfen @haiku ile yap.'` → `'haiku'`; `'@haiku ... @opus'` → `'haiku'`.
  - `detectOverride('ali@opus.com')` → `null`; `'@gpt4 x'` → `null`; `'@opuss x'` → `null`; `''`, `undefined`, `42` → `null`.
  - `buildContext('fable')` dizesi `fable` ve `model-routing` içerir; `buildContext(null)` dizesi `model-routing` içerir, `fable` etiketini seçilmiş gibi anmaz; ikisi de 10.000 karakterden kısa.
  - `run(JSON.stringify({prompt:'@sonnet x'}))` çıktısı parse edilince `hookSpecificOutput.hookEventName === 'UserPromptSubmit'` ve `additionalContext` string.
  - `run('')`, `run('{bozuk')`, `run('{"prompt":42}')`, `run('{}')` → `''`.
  - 100.000 karakterlik `prompt` ile `run` geçerli JSON döner.
  - Süreç testi: `child_process.spawnSync('node', ['route-hook.js'], {input: '{bozuk'})` → `status === 0`, `stdout === ''`; geçerli girdide `status === 0` ve stdout geçerli JSON.
- [ ] **Step 2: Testin başarısız olduğunu doğrula.** Run: `node --test model-router/hooks/`. Expected: FAIL (`route-hook.js` bulunamadı).
- [ ] **Step 3: `route-hook.js` dosyasını yukarıdaki arayüzlerle yaz.** Etiket eşleme için tek bir düzenli ifade; `run` içinde tüm akış try/catch içinde, hata → `''`.
- [ ] **Step 4: Testlerin geçtiğini doğrula.** Run: `node --test model-router/hooks/`. Expected: tüm testler PASS.
- [ ] **Step 5: Plugin doğrulaması.** Run: `claude plugin validate ./model-router`. Expected: `Validation passed`.
- [ ] **Step 6: Commit** `git add model-router && git commit -m "feat: add routing hook with override detection"`

### Task 3: `model-routing` skill'i

**Files:**
- Create: `model-router/skills/model-routing/SKILL.md`

**Interfaces:**
- Consumes: Task 2'nin enjekte ettiği bağlam (override varsa model adı; yoksa skill hatırlatması).
- Produces: kullanıcıya görünen bildirim satırı ve `Agent(model=…)` çağrısı.

- [ ] **Step 1: Frontmatter yaz.** `name: model-routing`; `description`: kodlama projesinde değişiklik/ekleme/hata düzeltme/refactor isteği geldiğinde, işi boyut ve etki alanına göre uygun modelde (haiku/sonnet/opus/fable) alt ajana yönlendirmek için kullanılır; soru, açıklama ve sohbet isteklerinde kullanılmaz.
- [ ] **Step 2: Gövdeyi şu bölümlerle yaz** (Global Constraints'teki değerlerle, Türkçe kullanıcı bildirimi): (1) kapsam kontrolü ve kapsam dışı örnekler (soru, açıklama, sohbet; yönlendirme yok); (2) override varsa sınıflandırma atlanır, o model kullanılır; (3) hafif inceleme: en fazla ~5 grep/glob ile etkilenen dosya ve modül sayısı, niyet ve risk; (4) seviye tablosu ve "belirsizse bir üst seviye" kuralı; (5) tek satır bildirim, formatıyla; (6) `Agent` aracını `model` parametresiyle, görev açıklaması ve bağlamla çağırma; (7) alt ajan sonucunu ana oturuma özetleme; (8) `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` durumunda yönlendirmeyi atla ve kullanıcıya bildir; (9) kullanıcıya yanlış seçimi `@model` ile düzeltebileceğini bildiren kısa not (yalnızca ilk yönlendirmede).
- [ ] **Step 3: Doğrula.** Run: `claude plugin validate ./model-router`. Expected: `Validation passed`.
- [ ] **Step 4: Commit** `git add model-router && git commit -m "feat: add model-routing skill"`

### Task 4: Senaryo listesi, README ve elle doğrulama

**Files:**
- Create: `model-router/tests/scenarios.md`
- Create: `model-router/README.md`

- [ ] **Step 1: `scenarios.md` yaz.** Her seviye için en az 3 örnek istek ve beklenen model (ör. "README'deki yazım hatasını düzelt" → haiku; "kullanıcı profili sayfasına avatar yükleme ekle" → sonnet; "auth katmanını oturum tabanlıdan token tabanlıya refactor et" → opus; "projeyi monolitten servis mimarisine böl" → fable), ayrıca: kapsam dışı örnekler (yönlendirme yok), `@haiku`/`@fable` override örnekleri ve geçersiz etiket örneği.
- [ ] **Step 2: `README.md` yaz.** Ne yaptığı, kurulum (`/plugin` ile), override kullanımı, seviye tablosu, bilinen sınırlama (seviye kararı modelin yargısıdır; hook yalnızca tetiklenmeyi garanti eder), `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` notu.
- [ ] **Step 3: Elle doğrulama.** Run: `claude --plugin-dir ./model-router` ile oturum aç; `scenarios.md`'deki her satırı çalıştır. Expected: bildirim satırındaki model beklenenle eşleşir; kapsam dışı isteklerde bildirim yok; override'da seçilen model kullanılır. Eşleşmeyen senaryoları SKILL.md'deki eşleme açıklamalarını netleştirerek düzelt ve tekrar çalıştır.
- [ ] **Step 4: Commit** `git add model-router && git commit -m "docs: add scenarios and README"`
