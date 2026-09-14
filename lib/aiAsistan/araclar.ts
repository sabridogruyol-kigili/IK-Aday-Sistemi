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
  {
    name: "personel_demografik_ozet",
    description: "Görebildiği aktif personelin cinsiyet dağılımını (kaç erkek, kaç kadın, oranları) verir. 'Kaç erkek çalışanım var' gibi sorularda kullanılır.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "magaza_ciro_performans_karsilastirma",
    description: "Mağazaların aylık gerçekleşen ciro, hedef ciro ve HGO (Hedef Gerçekleştirme Oranı) değerlerini karşılaştırır. Belirli bir ay/yıl verilmezse en son mevcut ay kullanılır.",
    input_schema: {
      type: "object" as const,
      properties: {
        yil: { type: "number", description: "Örn. 2026 — belirtilmezse en son ay kullanılır" },
        ay: { type: "number", description: "1-12 arası — belirtilmezse en son ay kullanılır" },
      },
    },
  },
  {
    name: "kidem_maas_sorgula",
    description: "Personeli kıdemine (işe başlama tarihinden bu yana geçen süre) göre sıralar, varsa ünvanına karşılık gelen brüt maaşı da gösterir. 'En yüksek kıdemli personel kim' gibi sorularda kullanılır.",
    input_schema: {
      type: "object" as const,
      properties: {
        siralama: { type: "string", enum: ["en_yuksek_kidem", "en_dusuk_kidem"] },
        limit: { type: "number", description: "Kaç kişi gösterilsin (varsayılan 5, en fazla 20)" },
      },
      required: ["siralama"],
    },
  },
  {
    name: "disiplin_kayitlari_ozeti",
    description: "İhtarname, uyarı yazısı, tutanak veya savunma kaydı bulunan personeli listeler. 'Disiplin kaydı olan kim var' gibi sorularda kullanılır.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "talep_istatistikleri",
    description: "Belirli bir tarih aralığındaki talepleri türüne (işe alım, işten çıkarma, rotasyon, norm değişikliği) ve durumuna göre sayar. 'Bu ay kaç talep açıldı' gibi sorularda kullanılır. Tarih verilmezse son 30 gün kullanılır.",
    input_schema: {
      type: "object" as const,
      properties: {
        baslangic_tarihi: { type: "string", description: "YYYY-MM-DD formatında" },
        bitis_tarihi: { type: "string", description: "YYYY-MM-DD formatında" },
      },
    },
  },
  {
    name: "aday_surec_dagilimi",
    description: "Görebildiği taleplere bağlı adayların hangi süreç aşamasında (yönlendirildi, onaylandı, görüşme planlandı, işe alındı, reddedildi vb.) olduğunun dağılımını verir.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "personel_gecmisi_sorgula",
    description: "Belirli bir kişinin (isimle aranır) TÜM istihdam geçmişini verir — hangi mağaza(lar)da hangi tarihler arasında çalıştığı, ayrıldıysa ne zaman ayrıldığı, tekrar işe girdiyse o dönemleri de dahil olmak üzere. 'Şu kişinin kıdem durumu nedir', 'bu kişi daha önce burada çalışmış mıydı' gibi sorularda kullanılır.",
    input_schema: {
      type: "object" as const,
      properties: { isim: { type: "string", description: "Aranacak kişinin adı soyadı (tam ya da kısmi)" } },
      required: ["isim"],
    },
  },
  {
    name: "ise_alim_suresi_ortalamasi",
    description: "Son tamamlanan işe alım süreçlerinde, talebin açılışından adayın işe alınmasına kadar ortalama kaç gün geçtiğini hesaplar.",
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

      case "personel_demografik_ozet": {
        const { data, error } = await supabase.from("personel").select("cinsiyet").eq("durum", "aktif");
        if (error) return { basarili: false, hata: error.message };
        const toplam = data?.length ?? 0;
        const erkek = (data ?? []).filter((p: any) => p.cinsiyet === "Erkek").length;
        const kadin = (data ?? []).filter((p: any) => p.cinsiyet === "Kadın").length;
        const belirtilmemis = toplam - erkek - kadin;
        return {
          basarili: true,
          veri: {
            toplam, erkek, kadin, belirtilmemis,
            erkek_orani_yuzde: toplam > 0 ? Math.round((erkek / toplam) * 1000) / 10 : null,
            kadin_orani_yuzde: toplam > 0 ? Math.round((kadin / toplam) * 1000) / 10 : null,
          },
        };
      }

      case "magaza_ciro_performans_karsilastirma": {
        let yil = Number(girdi?.yil);
        let ay = Number(girdi?.ay);
        if (!yil || !ay) {
          const { data: enSon } = await supabase.from("performans_kisi_aylik").select("yil, ay").order("yil", { ascending: false }).order("ay", { ascending: false }).limit(1).maybeSingle();
          if (!enSon) return { basarili: true, veri: { mesaj: "Hiç performans verisi bulunamadı." } };
          yil = enSon.yil; ay = enSon.ay;
        }
        const { data: kisiVerisi, error } = await supabase
          .from("performans_kisi_aylik")
          .select("hedef_ciro_kdv_dahil, gerceklesen_ciro_kdv_dahil, personel:personel_id(guncel_magaza_id, magazalar:guncel_magaza_id(magaza_adi))")
          .eq("yil", yil).eq("ay", ay);
        if (error) return { basarili: false, hata: error.message };
        const magazaMap: Record<string, { magaza: string; hedef: number; gerceklesen: number }> = {};
        (kisiVerisi ?? []).forEach((k: any) => {
          const magazaAdi = k.personel?.magazalar?.magaza_adi;
          if (!magazaAdi) return;
          if (!magazaMap[magazaAdi]) magazaMap[magazaAdi] = { magaza: magazaAdi, hedef: 0, gerceklesen: 0 };
          magazaMap[magazaAdi].hedef += k.hedef_ciro_kdv_dahil ?? 0;
          magazaMap[magazaAdi].gerceklesen += k.gerceklesen_ciro_kdv_dahil ?? 0;
        });
        const sonuc = Object.values(magazaMap).map((m) => ({
          ...m, hgo_yuzde: m.hedef > 0 ? Math.round((m.gerceklesen / m.hedef) * 1000) / 10 : null,
        }));
        return { basarili: true, veri: { yil, ay, magazalar: sonuc } };
      }

      case "kidem_maas_sorgula": {
        const limit = Math.min(Number(girdi?.limit) || 5, 20);
        const artan = girdi?.siralama === "en_dusuk_kidem";
        const { data, error } = await supabase
          .from("personel")
          .select("ad_soyad, guncel_unvan, kidem_baslangic_tarihi")
          .eq("durum", "aktif")
          .not("kidem_baslangic_tarihi", "is", null)
          .order("kidem_baslangic_tarihi", { ascending: !artan })
          .limit(limit);
        if (error) return { basarili: false, hata: error.message };
        const unvanlar = Array.from(new Set((data ?? []).map((p: any) => p.guncel_unvan).filter(Boolean)));
        const { data: maaslar } = unvanlar.length > 0
          ? await supabase.from("unvan_maas").select("unvan, brut_maas").in("unvan", unvanlar)
          : { data: [] as any[] };
        const maasMap: Record<string, number> = {};
        (maaslar ?? []).forEach((m: any) => { maasMap[m.unvan] = m.brut_maas; });
        const simdi = Date.now();
        return {
          basarili: true,
          veri: (data ?? []).map((p: any) => ({
            ad_soyad: p.ad_soyad, unvan: p.guncel_unvan,
            kidem_ay: p.kidem_baslangic_tarihi ? Math.round((simdi - new Date(p.kidem_baslangic_tarihi).getTime()) / (1000 * 60 * 60 * 24 * 30)) : null,
            brut_maas: maasMap[p.guncel_unvan] ?? null,
          })),
        };
      }

      case "disiplin_kayitlari_ozeti": {
        const { data, error } = await supabase
          .from("personel")
          .select("ad_soyad, guncel_unvan, ihtarname, uyari_yazisi, tutanak, savunma")
          .eq("durum", "aktif");
        if (error) return { basarili: false, hata: error.message };
        const sayiyaCevir = (v: any) => Number(v) || 0;
        const kayitliOlanlar = (data ?? [])
          .map((p: any) => ({
            ad_soyad: p.ad_soyad, unvan: p.guncel_unvan,
            ihtarname: sayiyaCevir(p.ihtarname), uyari_yazisi: sayiyaCevir(p.uyari_yazisi),
            tutanak: sayiyaCevir(p.tutanak), savunma: sayiyaCevir(p.savunma),
          }))
          .filter((p) => p.ihtarname > 0 || p.uyari_yazisi > 0 || p.tutanak > 0 || p.savunma > 0);
        return { basarili: true, veri: kayitliOlanlar };
      }

      case "talep_istatistikleri": {
        const bitis = girdi?.bitis_tarihi ? new Date(girdi.bitis_tarihi) : new Date();
        const baslangic = girdi?.baslangic_tarihi ? new Date(girdi.baslangic_tarihi) : new Date(bitis.getTime() - 30 * 24 * 60 * 60 * 1000);
        const { data, error } = await supabase
          .from("talepler")
          .select("talep_turu, durum")
          .gte("created_at", baslangic.toISOString())
          .lte("created_at", bitis.toISOString());
        if (error) return { basarili: false, hata: error.message };
        const turDagilimi: Record<string, number> = {};
        const durumDagilimi: Record<string, number> = {};
        (data ?? []).forEach((t: any) => {
          turDagilimi[t.talep_turu] = (turDagilimi[t.talep_turu] ?? 0) + 1;
          durumDagilimi[t.durum] = (durumDagilimi[t.durum] ?? 0) + 1;
        });
        return { basarili: true, veri: { toplam: data?.length ?? 0, tur_bazinda: turDagilimi, durum_bazinda: durumDagilimi, baslangic: baslangic.toISOString().slice(0, 10), bitis: bitis.toISOString().slice(0, 10) } };
      }

      case "aday_surec_dagilimi": {
        const { data, error } = await supabase.from("adaylar").select("durum");
        if (error) return { basarili: false, hata: error.message };
        const dagilim: Record<string, number> = {};
        (data ?? []).forEach((a: any) => { dagilim[a.durum] = (dagilim[a.durum] ?? 0) + 1; });
        return { basarili: true, veri: { toplam: data?.length ?? 0, durum_bazinda: dagilim } };
      }

      case "personel_gecmisi_sorgula": {
        const isim = String(girdi?.isim ?? "").trim();
        if (!isim) return { basarili: false, hata: "İsim belirtilmedi." };

        const { data: kisiler, error } = await supabase
          .from("personel")
          .select("id, ad_soyad, guncel_unvan, durum, kidem_baslangic_tarihi, magazalar!guncel_magaza_id(magaza_adi)")
          .ilike("ad_soyad", `%${isim}%`)
          .limit(5);
        if (error) return { basarili: false, hata: error.message };
        if (!kisiler || kisiler.length === 0) return { basarili: true, veri: { mesaj: `"${isim}" ile eşleşen, görebildiğiniz bir personel bulunamadı.` } };

        const sonuc = await Promise.all(kisiler.map(async (k: any) => {
          const { data: donemler } = await supabase
            .from("personel_atama_gecmisi")
            .select("baslama_tarihi, ayrilma_tarihi, magazalar!magaza_id(magaza_adi)")
            .eq("personel_id", k.id)
            .order("baslama_tarihi", { ascending: true });
          return {
            ad_soyad: k.ad_soyad,
            guncel_unvan: k.guncel_unvan,
            guncel_durum: k.durum === "aktif" ? "Hâlâ aktif çalışıyor" : "Şu an pasif/ayrılmış",
            guncel_magaza: k.magazalar?.magaza_adi ?? null,
            istihdam_donemleri: (donemler ?? []).map((d: any) => ({
              magaza: d.magazalar?.magaza_adi ?? null,
              baslama_tarihi: d.baslama_tarihi,
              ayrilma_tarihi: d.ayrilma_tarihi,
              devam_ediyor_mu: !d.ayrilma_tarihi,
            })),
          };
        }));
        return { basarili: true, veri: sonuc };
      }

      case "ise_alim_suresi_ortalamasi": {
        const { data: iseAlinanlar } = await supabase
          .from("adaylar")
          .select("id, created_at, talep_id, talepler:talep_id(created_at)")
          .eq("durum", "ISE_ALINDI")
          .limit(200);
        if (!iseAlinanlar || iseAlinanlar.length === 0) return { basarili: true, veri: { mesaj: "Henüz tamamlanmış işe alım süreci bulunamadı." } };

        const { data: gecmisKayitlari } = await supabase
          .from("aday_surec_gecmisi")
          .select("aday_id, created_at")
          .eq("durum", "ISE_ALINDI")
          .in("aday_id", iseAlinanlar.map((a: any) => a.id).filter(Boolean));

        const sureler: number[] = [];
        for (const a of iseAlinanlar as any[]) {
          const talepAcilis = a.talepler?.created_at;
          if (!talepAcilis) continue;
          const iseAlimTarihi = (gecmisKayitlari ?? []).find((g: any) => g.aday_id === a.id)?.created_at ?? a.created_at;
          const gun = (new Date(iseAlimTarihi).getTime() - new Date(talepAcilis).getTime()) / (1000 * 60 * 60 * 24);
          if (gun >= 0) sureler.push(gun);
        }
        if (sureler.length === 0) return { basarili: true, veri: { mesaj: "Süre hesaplanabilecek kayıt bulunamadı." } };
        const ortalama = sureler.reduce((a, b) => a + b, 0) / sureler.length;
        return { basarili: true, veri: { ornek_sayisi: sureler.length, ortalama_gun: Math.round(ortalama * 10) / 10 } };
      }

      default:
        return { basarili: false, hata: "Bilinmeyen araç: " + adi };
    }
  } catch (e: any) {
    return { basarili: false, hata: e?.message ?? "Beklenmeyen hata." };
  }
}
