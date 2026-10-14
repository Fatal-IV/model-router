# Senaryolar (elle doğrulama)

Oturumu `claude --plugin-dir ./model-router` ile aç, her isteği ver ve bildirim satırındaki modeli beklenenle karşılaştır.

## Seviye eşlemesi

| İstek | Beklenen |
|---|---|
| README'deki yazım hatasını düzelt | haiku |
| Butonun rengini maviden yeşile çevir | haiku |
| `getUser` fonksiyonunu `fetchUser` olarak yeniden adlandır (tek dosya, kullanım yok) | haiku |
| Kullanıcı profili sayfasına avatar yükleme ekle | sonnet |
| Login formundaki boş e-posta hatasını düzelt (form + doğrulama + test) | sonnet |
| Listeye sayfalama ekle (API + arayüz) | sonnet |
| Auth katmanını oturum tabanlıdan token tabanlıya refactor et | opus |
| Tüm modüllerde kullanılan hata işleme yapısını değiştir | opus |
| Aralıklı çöken, nedeni bilinmeyen eşzamanlılık hatasını bul ve düzelt | opus |
| Projeyi monolitten servis mimarisine böl | fable |
| Veri modelini çok kiracılı (multi-tenant) yapıya taşı | fable |

## Kapsam dışı (bildirim satırı ve alt ajan olmamalı)

- Bu fonksiyon ne yapıyor?
- Repository deseni nedir, kısaca anlat.
- Merhaba, nasılsın?

## Override

| İstek | Beklenen |
|---|---|
| `@fable README'deki yazım hatasını düzelt` | fable, gerekçe: kullanıcı seçimi |
| `@haiku auth katmanını refactor et` | haiku, gerekçe: kullanıcı seçimi |
| `@haiku bu fonksiyon ne yapıyor?` | haiku, gerekçe: kullanıcı seçimi (soru olsa da devredilir) |
| `@opus'la README'deki yazım hatasını düzelt` | opus (apostrof ekli etiket) |
| `@OPUS butonun rengini değiştir` | opus (büyük/küçük harf fark etmez) |
| `@gpt4 butonun rengini değiştir` | override sayılmaz; normal sınıflandırma (haiku) |
| `ali@opus.com adresini README'ye ekle` | override sayılmaz; normal sınıflandırma (haiku) |

## Ortam

- `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` ile bir kodlama isteği: yönlendirme yok, "devre dışı" bildirimi var.
