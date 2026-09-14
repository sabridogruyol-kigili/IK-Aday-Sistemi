import { createClient } from "@/lib/supabase/server";

// ============================================================
// AI Asistanı Araçları
// ============================================================
// ÖNEMLİ GÜVENLİK İLKESİ: Her araç, çağıran kullanıcının kendi oturum
// bağlantısını (createClient() — cookie tabanlı, RLS'e tabi) kullanır.
// Yani bir BM için çalıştırılan bir araç, BM'nin normal uygulamada
// göremediği hiçbir satırı da göremez — bu, "AI'a talimatla" değil,
// veritabanının kendisi tarafından garanti edilen bir kısıtlamadır.
// Yeni bir araç eklerken ASLA admin/service-role bağlantı kullanmayın.
// ============================================================

export type AracSonucu = { basarili: boolean; veri?: any; hata?: string };

export const ARAC_TANIMLARI = [
  {
    name: "personel_performans_sirala",
    description: "Aktif personeli ortalama HGO (Hedef Gerçekleştirme Oranı) performansına göre sıralar. 'En düşük performanslı kişi/aday kim' gibi sorularda kullanılır.",
    input_schema: {
      type: "object" as const,
      properties: {
        siralama: { type: "string", enum: ["en_dusuk", "en_yuksek"], description: "Sıralama yönü" },
        limit: { type: "number", description: "Kaç kişi gösterilsin (varsayılan 5, en fazla 20)" },
      },
      required: ["siralama"],
    },
  },
  {
    name: "bekleyen_talep_onaylarim",
    description: "Şu an oturum açmış kullanıcının onayını bekleyen talepleri (işe alım, işten çıkarma, rotasyon, norm değişikliği) listeler.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "norm_doluluk_ozeti",
    description: "Mağazaların norm (kadro) doluluk durumunu özetler — hangi mağazada norm açığı ya da fazlası var. 'Hangi mağazada eksik personel var' gibi sorularda kullanılır.",
    input_schema: {
      type: "object" as const,
      properties: { sadece_acik_olanlar: { type: "boolean", description: "true ise sadece norm açığı olan mağazalar döner" } },
    },
  },
  {
    name: "evrak_sureci_ozeti",
    description: "İşe alınmış ama evrak süreci (İK onayı veya bordro sisteme giriş) henüz tamamlanmamış kişileri sayar ve listeler. Bu araç sadece İK, Yönetim ve Bordro rollerine anlamlı sonuç döner — diğer roller için boş döner.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "aktif_personel_sayisi",
    description: "Görebildiği mağaza/bölgelerdeki toplam aktif personel sayısını, ünvan bazında kırılımıyla verir.",
    input_schema: { type: "object" as const, properties: {} },
  },
] as const;

async function benimBilgilerim() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  return me;
}

export async function aracCalistir(adi: string, girdi: any): Promise<AracSonucu> {
  const supabase = createClient();
  const me = await benimBilgilerim();
  if (!me) return { basarili: false, hata: "Oturum bulunamadı." };

  try {
    switch (adi) {
      case "personel_performans_sirala": {
        const limit = Math.min(Number(girdi?.limit) || 5, 20);
        const artan = girdi?.siralama === "en_dusuk";
        const { data, error } = await supabase
          .from("personel")
          .select("ad_soyad, guncel_unvan, performans_ortalama_hgo, magazalar!guncel_magaza_id(magaza_adi)")
          .eq("durum", "aktif")
          .not("performans_ortalama_hgo", "is", null)
          .order("performans_ortalama_hgo", { ascending: artan })
          .limit(limit);
        if (error) return { basarili: false, hata: error.message };
        return {
          basarili: true,
          veri: (data ?? []).map((p: any) => ({
            ad_soyad: p.ad_soyad, unvan: p.guncel_unvan, magaza: p.magazalar?.magaza_adi ?? null,
            ortalama_hgo: p.performans_ortalama_hgo,
          })),
        };
      }

      case "bekleyen_talep_onaylarim": {
        const { data, error } = await supabase
          .from("talep_onaylari")
          .select("talep_gonderimler!inner(talepler!inner(talep_no, talep_turu, pozisyon_tipi, magazalar!magaza_id(magaza_adi)))")
          .eq("onaylayici_kullanici_id", me.id)
          .is("karar", null);
        if (error) return { basarili: false, hata: error.message };
        return {
          basarili: true,
          veri: (data ?? []).map((o: any) => ({
            talep_no: o.talep_gonderimler.talepler.talep_no,
            tur: o.talep_gonderimler.talepler.talep_turu,
            pozisyon: o.talep_gonderimler.talepler.pozisyon_tipi,
            magaza: o.talep_gonderimler.talepler.magazalar?.magaza_adi ?? null,
          })),
        };
      }

      case "norm_doluluk_ozeti": {
        const [{ data: normlar }, { data: personelSayilari }] = await Promise.all([
          supabase.from("norm").select("magaza_id, ana_kadro_norm, magazalar!magaza_id(magaza_adi)"),
          supabase.from("personel").select("guncel_magaza_id").eq("durum", "aktif").eq("kadro_kategorisi", "ANA_KADRO"),
        ]);
        const sayimMap: Record<string, number> = {};
        (personelSayilari ?? []).forEach((p: any) => {
          if (p.guncel_magaza_id) sayimMap[p.guncel_magaza_id] = (sayimMap[p.guncel_magaza_id] ?? 0) + 1;
        });
        let sonuc = (normlar ?? []).map((n: any) => ({
          magaza: n.magazalar?.magaza_adi ?? null,
          norm: n.ana_kadro_norm ?? 0,
          dolu: sayimMap[n.magaza_id] ?? 0,
          fark: (n.ana_kadro_norm ?? 0) - (sayimMap[n.magaza_id] ?? 0),
        }));
        if (girdi?.sadece_acik_olanlar) sonuc = sonuc.filter((s) => s.fark > 0);
        return { basarili: true, veri: sonuc };
      }

      case "evrak_sureci_ozeti": {
        if (me.rol !== "IK" && me.rol !== "YONETIM" && me.rol !== "BORDRO") {
          return { basarili: true, veri: { mesaj: "Bu bilgiye erişim yetkiniz yok." } };
        }
        const { data: tokenlar } = await supabase.from("evrak_erisim_tokenlari").select("personel_id");
        const personelIdleri = Array.from(new Set((tokenlar ?? []).map((t: any) => t.personel_id)));
        if (personelIdleri.length === 0) return { basarili: true, veri: [] };
        const { data: personelListesi } = await supabase
          .from("personel")
          .select("ad_soyad, bordro_giris_tarihi, evrak_iptal_nedeni")
          .in("id", personelIdleri);
        const bekleyenler = (personelListesi ?? []).filter((p: any) => !p.bordro_giris_tarihi && !p.evrak_iptal_nedeni);
        return { basarili: true, veri: { toplam_bekleyen: bekleyenler.length, kisiler: bekleyenler.map((p: any) => p.ad_soyad) } };
      }

      case "aktif_personel_sayisi": {
        const { data, error } = await supabase.from("personel").select("guncel_unvan").eq("durum", "aktif");
        if (error) return { basarili: false, hata: error.message };
        const kirilim: Record<string, number> = {};
        (data ?? []).forEach((p: any) => {
          const u = p.guncel_unvan ?? "Belirtilmemiş";
          kirilim[u] = (kirilim[u] ?? 0) + 1;
        });
        return { basarili: true, veri: { toplam: data?.length ?? 0, unvan_bazinda: kirilim } };
      }

      default:
        return { basarili: false, hata: "Bilinmeyen araç: " + adi };
    }
  } catch (e: any) {
    return { basarili: false, hata: e?.message ?? "Beklenmeyen hata." };
  }
}
