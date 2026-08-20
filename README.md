# QHR Norm Kadro Sistemi — Next.js İskeleti

## Kurulum

1. `npm install`
2. `.env.local.example` dosyasını `.env.local` olarak kopyalayın, Supabase proje bilgilerinizi
   (Project Settings > API sayfasından) girin:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `npm run dev` — http://localhost:3000

## Yapı

```
app/
  (app)/            -> Sol menülü ana uygulama kabuğu (layout.tsx)
    dashboard/
    norm/
    talepler/
      yeni/
    onay-bekleyenler/
    personel/
    raporlar/
    bildirimler/
  login/            -> Auth kurulana kadar geçici giriş ekranı
lib/
  supabase/
    client.ts       -> Tarayıcı tarafı Supabase istemcisi
    server.ts       -> Sunucu tarafı Supabase istemcisi (RLS için cookie okur)
```

## Şu an eksik / bilerek yapılmadı

- **Auth (Email OTP)**: Supabase Auth kurulmadan sayfalar veri çekemez, RLS politikaları
  da kullanıcı kimliği olmadan hiçbir satır döndürmez (bilerek "kilitli" bırakıldı).
- **Gerçek veri bağlantıları**: Her sayfada `TODO` yorumları var — hangi tablodan
  hangi sorgunun çekileceği belirtilmiş, ama sorgu kodu henüz yazılmadı.
- **Talep formu mantığı, onay akışı, kıdem/HGO hesaplama fonksiyonları**: Bunlar
  ayrı bir "iş mantığı" (business logic) katmanı olarak eklenecek — Supabase Edge
  Functions veya Next.js Route Handler'lar üzerinden.

## Sıradaki adımlar (önerilen sıra)

1. Supabase Auth: Email OTP + kurumsal domain kısıtlaması
2. `kullanicilar` tablosunu `auth.users` ile eşleyen bir trigger/fonksiyon
3. RLS politikaları (002_rls_policies.sql)
4. Dashboard'a gerçek veri bağlantısı
5. Talep formu + norm kontrol mantığı
6. Google Drive entegrasyonu (CV yükleme)
