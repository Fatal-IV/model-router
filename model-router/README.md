# Model Router

Claude Code plugin'i. Kodlama projesinde bir değişiklik veya ekleme istediğinde, isteğin boyutuna ve etki alanına göre işi uygun modelle çalışan bir alt ajana devreder ve seçimi bildirir:

```
→ Opus'a yönlendirildi: 12 dosyayı etkileyen refactor
```

Ana oturumun modeli değişmez; iş, seçilen modelde bir alt ajanda çalışır ve sonucu özetlenerek döner.

## Kurulum

Plugin dizinini Claude Code'a ekle (`/plugin` ile bir marketplace üzerinden ya da geliştirme için `claude --plugin-dir ./model-router`).

## Seviyeler

| Model | Ne zaman |
|---|---|
| Haiku | Tek dosya, mekanik değişiklik (metin, renk, isim, küçük düzeltme) |
| Sonnet | Birkaç dosyayı etkileyen normal özellik veya hata düzeltme |
| Opus | Çok dosyalı, modüller arası değişiklik, refactor, zor hata ayıklama |
| Fable | Mimari kararlar, büyük tasarım, çok yüksek riskli veya belirsiz işler |

Belirsizlikte bir üst seviye seçilir. Soru, açıklama ve sohbet isteklerinde yönlendirme yapılmaz.

## Modeli kendin seç

İsteğe `@haiku`, `@sonnet`, `@opus` veya `@fable` ekle. Bu etiket her zaman otomatik seçimin önüne geçer:

```
@haiku bu butonun rengini yeşil yap
```

## Nasıl çalışır

- **Hook** (`hooks/route-hook.js`): her istekte çalışır, override etiketini yakalar ve Claude'a `model-routing` skill'ini hatırlatan bağlam ekler. İsteği asla engellemez.
- **Skill** (`skills/model-routing`): hafif kod incelemesiyle etki alanını ölçer, seviyeyi seçer, bildirir ve `Agent` aracını `model` parametresiyle çağırır.

## Sınırlamalar

- Hook yalnızca skill'in tetiklenmesini sağlar; seviye kararı modelin yargısıdır ve her zaman doğru olmayabilir. Yanlış seçimi `@model` ile düzeltebilirsin.
- `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` ayarlıysa çağrı başına model seçilemez; yönlendirme bu durumda devre dışı kalır.

## Geliştirme

```
node --test hooks/route-hook.test.js
claude plugin validate .
```

Elle doğrulama senaryoları: `tests/scenarios.md`.
