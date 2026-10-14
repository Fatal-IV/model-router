---
name: model-routing
description: Kullanıcı kodlama projesinde bir değişiklik, ekleme, hata düzeltme veya refactor istediğinde, işi boyut ve etki alanına göre uygun modelde (haiku, sonnet, opus, fable) bir alt ajana yönlendirmek için kullanılır. Soru, açıklama ve sohbet isteklerinde kullanılmaz; ancak kullanıcı @haiku, @sonnet, @opus veya @fable ile model seçtiyse istek türünden bağımsız olarak kullanılır.
---

# Model Routing

Kodlama değişikliği isteklerini, kapsamına uygun modelle çalışan bir alt ajana devret ve seçimi kullanıcıya bildir. Ana oturumun modeli değişmez.

**Kural: kapsam içindeki her istek devredilir.** İş ne kadar küçük olursa olsun (tek kelimelik düzeltme dahil) ana oturum dosyayı kendisi düzenlemez; bildirim satırı yazılır ve `Agent` aracı çağrılır. Küçük işlerin en ucuz modele (`haiku`) gitmesi bu skill'in asıl amacıdır. "Alt ajan açmadan doğrudan yapayım" seçeneği yoktur.

## 1. Override (önce bu kontrol edilir)

Hook bağlamında kullanıcının bir model seçtiği (`@haiku`, `@sonnet`, `@opus`, `@fable`) belirtilmişse kapsam kontrolünü, sınıflandırmayı ve incelemeyi atla; doğrudan 6. adıma geç ve o modeli kullan. Override, isteğin türünden bağımsız olarak geçerlidir: `@haiku bu fonksiyon ne yapıyor?` gibi bir soru da seçilen modelle bir alt ajana devredilir. Gerekçe satırı `kullanıcı seçimi` olur.

## 2. Zorlanmış model kontrolü

Hook bağlamında `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` nedeniyle yönlendirmenin devre dışı olduğu belirtilmişse yönlendirme yapma, işi normal şekilde yap ve kullanıcıya tek satırla bildir: `Model yönlendirme devre dışı: CLAUDE_CODE_SUBAGENT_MODEL_FORCE ayarlı.` (Ortam değişkenini hook okur; sen okumaya çalışma.)

## 3. Kapsam kontrolü

Override yoksa yönlendirme **yalnızca** kodu değiştirecek isteklerde yapılır: özellik ekleme, hata düzeltme, refactor, yapılandırma veya metin değişikliği.

Yönlendirme **yapılmaz**: "bu fonksiyon ne yapıyor?", kod açıklama, kavramsal soru, sohbet. Bunları ana oturumda doğrudan cevapla ve bu skill'in kalanını atla.

## 4. Hafif inceleme

En fazla yaklaşık 5 arama (Grep/Glob) ile şunları ölç:

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

## 5b. Maliyet onayı (yalnızca otomatik `opus` veya `fable` seçimi)

Otomatik seçim `opus` ya da `fable` çıktıysa bu modeller maliyetli olduğu için devretmeden önce kullanıcıdan onay al. Kullanıcı `@opus`/`@fable` yazdıysa (1. adım) onay zaten verilmiştir; bu adımı atla.

1. `AskUserQuestion` aracıyla tek soru sor: seçilen modeli ve gerekçeyi söyle, daha maliyetli olduğunu belirt. İki seçenek ver: seçilen modelle devam (`Evet, Opus ile` / `Evet, Fable ile`) ve `Hayır, Sonnet ile`.
2. Kullanıcı onaylarsa seçilen modelle 6. adıma geç, bildirim satırının sonuna `(onaylandı)` ekle.
3. Kullanıcı reddederse, cevap vermezse veya soru sorulamıyorsa (araç yok, etkileşimsiz oturum) `sonnet` ile devam et ve bildirim satırı şöyle olsun: `→ Sonnet'e yönlendirildi: <Opus veya Fable> önerildi, onay verilmedi`.
4. Onay, soruyu cevaplayan o isteğe özeldir; sonraki isteklerde yeniden sor.

## 6. Bildir ve devret

1. Kullanıcıya tek satır yaz (onay adımından geçtiyse oradaki biçimi kullan): `→ <Model>'e yönlendirildi: <kısa gerekçe>` (örn. `→ Opus'a yönlendirildi: 12 dosyayı etkileyen refactor`).
2. Yalnızca bu skill'in ilk kullanıldığı oturumda, bir satır ekle: `Yanlış seçim olduysa isteğe @haiku, @sonnet, @opus veya @fable ekleyerek modeli sen belirleyebilirsin.`
3. `Agent` aracını `model` parametresi seçilen takma adla (`haiku`, `sonnet`, `opus`, `fable`) çağır. Prompt'a şunları koy: kullanıcının isteği, incelemede bulduğun dosyalar ve sınırlar, beklenen çıktı.

## 7. Sonucu özetle

Alt ajan bittiğinde ana oturuma neyin değiştiğini kısaca özetle: dosyalar, davranış farkı, doğrulama sonucu. Alt ajanın ham çıktısını yapıştırma.
