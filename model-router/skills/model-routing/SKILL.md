---
name: model-routing
description: Kullanıcı kodlama projesinde bir değişiklik, ekleme, hata düzeltme veya refactor istediğinde, işi boyut ve etki alanına göre uygun modelde (haiku, sonnet, opus, fable) bir alt ajana yönlendirmek için kullanılır. Soru, açıklama ve sohbet isteklerinde kullanılmaz.
---

# Model Routing

Kodlama değişikliği isteklerini, kapsamına uygun modelle çalışan bir alt ajana devret ve seçimi kullanıcıya bildir. Ana oturumun modeli değişmez.

## 1. Kapsam kontrolü

Yönlendirme **yalnızca** kodu değiştirecek isteklerde yapılır: özellik ekleme, hata düzeltme, refactor, yapılandırma veya metin değişikliği.

Yönlendirme **yapılmaz**: "bu fonksiyon ne yapıyor?", kod açıklama, kavramsal soru, sohbet. Bunları ana oturumda doğrudan cevapla ve bu skill'in kalanını atla.

## 2. Zorlanmış model kontrolü

`CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` ortam değişkeni ayarlıysa çağrı başına model verilemez. Bu durumda yönlendirme yapma, işi normal şekilde yap ve kullanıcıya tek satırla bildir: `Model yönlendirme devre dışı: CLAUDE_CODE_SUBAGENT_MODEL_FORCE ayarlı.`

## 3. Override

Hook bağlamında kullanıcının bir model seçtiği (`@haiku`, `@sonnet`, `@opus`, `@fable`) belirtilmişse sınıflandırma ve inceleme adımlarını atla; o modeli kullan. Override, isteğin türünden bağımsız olarak geçerlidir ve gerekçe satırı `kullanıcı seçimi` olur.

## 4. Hafif inceleme

Override yoksa en fazla yaklaşık 5 arama (Grep/Glob) ile şunları ölç:

- İsteğin dokunacağı sembol veya dosyalar ve bunları kullanan yerler (etkilenen dosya ve modül sayısı)
- Değişiklik mekanik mi, davranışsal mı, mimari mi
- Risk: paylaşılan arayüz, veri modeli, güvenlik, geri alınamaz etki

Amaç etki alanını kabaca ölçmektir; işi bu aşamada yapma.

## 5. Seviye seçimi

| Model | Ne zaman |
|---|---|
| `haiku` | Tek dosya, mekanik değişiklik: metin, renk, isim değişikliği, küçük düzeltme, yorum ekleme |
| `sonnet` | Birkaç dosyayı etkileyen normal özellik ekleme veya hata düzeltme |
| `opus` | Çok dosyalı, modüller arası etkisi olan değişiklik, refactor, zor hata ayıklama |
| `fable` | Mimari kararlar, büyük sistem tasarımı, çok yüksek riskli veya belirsiz işler |

İki seviye arasında kaldıysan **bir üst seviyeyi** seç.

## 6. Bildir ve devret

1. Kullanıcıya tek satır yaz: `→ <Model>'e yönlendirildi: <kısa gerekçe>` (örn. `→ Opus'a yönlendirildi: 12 dosyayı etkileyen refactor`).
2. Yalnızca bu skill'in ilk kullanıldığı oturumda, bir satır ekle: `Yanlış seçim olduysa isteğe @haiku, @sonnet, @opus veya @fable ekleyerek modeli sen belirleyebilirsin.`
3. `Agent` aracını `model` parametresi seçilen takma adla (`haiku`, `sonnet`, `opus`, `fable`) çağır. Prompt'a şunları koy: kullanıcının isteği, incelemede bulduğun dosyalar ve sınırlar, beklenen çıktı.

## 7. Sonucu özetle

Alt ajan bittiğinde ana oturuma neyin değiştiğini kısaca özetle: dosyalar, davranış farkı, doğrulama sonucu. Alt ajanın ham çıktısını yapıştırma.
