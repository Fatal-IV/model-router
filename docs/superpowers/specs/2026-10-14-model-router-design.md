# Model Router: Tasarım Spec'i

Tarih: 2026-10-14

## Amaç

Genel kullanıcıya yönelik bir Claude Code plugin'i. Kullanıcı kendi kodlama projesinde bir değişiklik veya ekleme istediğinde, isteğin boyutuna ve etki alanına göre işi Haiku, Sonnet, Opus veya Fable modellerinden uygun olanıyla çalışan bir alt ajana otomatik devreder ve seçimi kullanıcıya bildirir.

## Kararlar (kullanıcı onaylı)

1. **Mekanizma:** Alt ajana yönlendirme. Ana oturumun modeli değişmez; iş, Agent aracının `model` parametresiyle seçilen modelde çalışan bir alt ajana devredilir.
2. **Bildirim:** Her yönlendirmede tek satır: `→ <Model>'e yönlendirildi: <kısa gerekçe>`.
3. **Sınıflandırma girdisi:** İstek metni + hafif kod incelemesi (grep/glob ile etkilenen dosya ve modül sayısı).
4. **Kullanıcı override'ı:** `@haiku`, `@sonnet`, `@opus`, `@fable` etiketleri. Override her zaman kazanır.
5. **Paketleme:** Skill + UserPromptSubmit hook.

## Seviye eşlemesi

| Model | Ne zaman |
|---|---|
| Haiku | Tek dosya, mekanik değişiklik (metin/renk/isim değişikliği, küçük düzeltme, yorum ekleme) |
| Sonnet | Birkaç dosyayı etkileyen normal özellik ekleme veya hata düzeltme |
| Opus | Çok dosyalı, modüller arası etkisi olan değişiklik, refactor, zor hata ayıklama |
| Fable | Mimari kararlar, büyük sistem tasarımı, çok yüksek riskli veya belirsiz işler |

İki seviye arasında belirsizlik varsa bir üst seviye seçilir.

## Yapı

```
model-router/        # "claude-" önekiyle başlayan plugin adları doğrulamada hata verir
├── .claude-plugin/plugin.json
├── hooks/hooks.json
├── hooks/route-hook.js
└── skills/model-routing/SKILL.md
```

### route-hook.js (Node.js)
- UserPromptSubmit olayında çalışır; stdin'den olay JSON'unu okur.
- İstekte geçerli bir override etiketi varsa: Claude'a "kullanıcı X'i seçti, sınıflandırma yapma, işi doğrudan X ile devret" bağlamını enjekte eder.
- Override yoksa: "Bu bir kodlama değişikliğiyse `model-routing` skill'ini uygula" hatırlatmasını enjekte eder.
- İsteğin kodlama işi olup olmadığına karar vermez.
- Hiçbir koşulda isteği bloklamaz; hata durumunda sessizce boş çıktı verir.
- Node.js seçildi: Windows/macOS/Linux'ta tek betik.

### SKILL.md (model-routing)
- Kapsam: kodlama değişikliği/ekleme istekleri. Soru, açıklama ve sohbet istekleri kapsam dışıdır; ana oturum cevaplar.
- Adımlar: (1) kapsam kontrolü, (2) hafif inceleme (sınırlı sayıda grep/glob), (3) seviye eşlemesi, (4) bildirim satırı, (5) Agent aracıyla `model` parametresi verilerek devretme, (6) alt ajan sonucunu ana oturuma özetleme.

## Akış

```
İstek → hook → override? → evet: doğrudan devret
                       → hayır: hatırlatma → kodlama mı?
                                   → hayır: ana oturum cevaplar
                                   → evet: inceleme → eşleme → bildirim → devret
```

## Hata ve uç durumlar

- Hook hatası: istek yönlendirmesiz normal akar.
- Belirsiz sınıflandırma: bir üst seviye.
- Geçersiz etiket (`@gpt4` gibi): override sayılmaz, normal sınıflandırma.
- Override + soru: kullanıcının seçimine uyulur.
- İnceleme maliyeti: birkaç aramayla sınırlı; amaç etki alanını kabaca ölçmek.
- Alt ajan sonucu ana oturuma özetlenerek döner.

## Test

- Hook: Node yerleşik test çalıştırıcısı ile birim testleri (her override biçimi, büyük/küçük harf, geçersiz etiket, boş girdi, bozuk JSON).
- Skill: her seviye için örnek isteklerden oluşan senaryo listesi; gerçek oturumda elle çalıştırılıp beklenen modelle karşılaştırılır. `skill-creator` ile eval opsiyonel.

## Bilinen sınırlama

Hook yalnızca tetiklenmeyi garanti eder; seviye kararı modelin yargısıdır ve her zaman doğru olmayabilir. Bildirim satırı bu yüzden zorunludur: kullanıcı yanlış seçimi görüp `@model` ile düzeltebilir.

## Doğrulanmış teknik noktalar (resmi dokümandan, 2026-10-14)

- Hook stdin JSON'unda istek metni `prompt` alanındadır.
- Bağlam enjeksiyonu: exit 0 + stdout'a `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"..."}}`. Metin sistem hatırlatması olarak eklenir; emir kipi yerine olgu bildiren cümleler yazılmalıdır (prompt-injection korumasını tetiklememek için). 10.000 karakteri aşan bağlam dosyaya yazılıp önizlemeyle değiştirilir. UserPromptSubmit isteği yeniden yazamaz, yalnızca bloklayabilir veya bağlam ekleyebilir.
- Exit 0 dışındaki kodlar bloklamayan hatadır ama kullanıcıya "hook error" bildirimi gösterilir; bu yüzden hook her durumda exit 0 ile biter.
- `hooks/hooks.json` üst düzey `"hooks"` anahtarıyla sarılır; `command: "node"` + `args: ["${CLAUDE_PLUGIN_ROOT}/hooks/route-hook.js"]` (exec biçimi, boşluklu yollarda güvenli).
- Agent aracı çağrı başına `model` parametresi alır; geçerli takma adlar: `haiku`, `sonnet`, `opus`, `fable`.
- Sınırlama: `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` ayarlıysa çağrı başına model verilemez. Skill bu durumda yönlendirmenin devre dışı olduğunu kullanıcıya bildirmelidir.
- Plugin adı kebab-case olmalı ve `claude-`, `anthropic-` ile başlamamalıdır; `claude plugin validate <dizin>` manifesti doğrular.
