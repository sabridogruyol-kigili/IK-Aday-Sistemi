import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RaporlarClient from "./RaporlarClient";

async function tumSatirlariGetir<T>(sorguOlustur: (bas: number, bitis: number) => any): Promise<T[]> {
  const PARCA = 1000;
  let tumSatirlar: T[] = [];
  let sayfa = 0;
  while (true) {
    const bas = sayfa * PARCA;
    const { data, error } = await sorguOlustur(bas, bas + PARCA - 1);
    if (error || !data) break;
    tumSatirlar = tumSatirlar.concat(data as T[]);
    if (data.length < PARCA) break;
    sayfa++;
  }
  return tumSatirlar;
}

export default async function RaporlarPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("kullanicilar").select("id, rol").eq("email", user.email).single();
  if (!me) redirect("/login");
  if (me.rol === "MAGAZALAR_DIREKTORLUGU") redirect("/dashboard");

  const [{ data: bolgeler }, { data: atamalarHam }, { data: magazalarHam }] = await Promise.all([
    supabase.from("bolgeler").select("id, ad").order("ad"),
    supabase.from("kullanici_bolge_atama").select("kullanici_id, bolge_id, kullanicilar!inner(id, ad_soyad, rol, aktif)"),
    supabase.from("magazalar").select("id, magaza_adi, magaza_kodu, bolge_id").eq("aktif", true),
  ]);

  const atamalar = (atamalarHam ?? []) as any[];
  const magazalar = magazalarHam ?? [];
  const magazaIdleri = magazalar.map((m) => m.id);

  const [normRes, personelListesi, performansMagazaListesi, talepler] = await Promise.all([
    magazaIdleri.length > 0
      ? supabase.from("norm").select("magaza_id, ana_kadro_norm, donemsel_norm, part_time_norm").in("magaza_id", magazaIdleri)
      : Promise.resolve({ data: [] as any[] }),
    magazaIdleri.length > 0
      ? tumSatirlariGetir<any>((bas, bitis) =>
          supabase
            .from("personel")
            .select("guncel_magaza_id, kadro_kategorisi, durum, performans_ortalama_hgo")
            .eq("durum", "aktif")
            .not("tc_kimlik_no", "like", "PLASIYER-%")
            .in("guncel_magaza_id", magazaIdleri)
            .range(bas, bitis)
        )
      : Promise.resolve([]),
    magazaIdleri.length > 0
      ? tumSatirlariGetir<any>((bas, bitis) =>
          supabase
            .from("performans_magaza_aylik")
            .select("magaza_id, yil, ay, hgo")
            .in("magaza_id", magazaIdleri)
            .order("yil").order("ay")
            .range(bas, bitis)
        )
      : Promise.resolve([]),
    tumSatirlariGetir<any>((bas, bitis) =>
      supabase
        .from("talepler")
        .select("id, talep_no, talep_turu, durum, magaza_id, acan_rol, pozisyon_tipi, created_at, updated_at")
        .range(bas, bitis)
    ),
  ]);

  // ---- Bölge -> BM / İK haritası (isim dahil) ----
  const bolgeBmMap: Record<string, { id: string; ad_soyad: string }[]> = {};
  const bolgeIkMap: Record<string, { id: string; ad_soyad: string }[]> = {};
  atamalar.forEach((a) => {
    const k = a.kullanicilar;
    if (!k?.aktif) return;
    if (k.rol === "BM") bolgeBmMap[a.bolge_id] = [...(bolgeBmMap[a.bolge_id] ?? []), { id: k.id, ad_soyad: k.ad_soyad }];
    if (k.rol === "IK") bolgeIkMap[a.bolge_id] = [...(bolgeIkMap[a.bolge_id] ?? []), { id: k.id, ad_soyad: k.ad_soyad }];
  });
  const bolgeAdiMap: Record<string, string> = {};
  (bolgeler ?? []).forEach((b) => { bolgeAdiMap[b.id] = b.ad; });

  // ---- Norm / doluluk / HGO (mağaza bazlı) ----
  const normMap: Record<string, number> = {};
  (normRes.data ?? []).forEach((n: any) => {
    normMap[n.magaza_id] = (n.ana_kadro_norm ?? 0) + (n.donemsel_norm ?? 0) + (n.part_time_norm ?? 0);
  });
  const doluMap: Record<string, number> = {};
  (personelListesi ?? []).forEach((p: any) => {
    if (["ANA_KADRO", "DONEMSEL", "PART_TIME"].includes(p.kadro_kategorisi)) {
      doluMap[p.guncel_magaza_id] = (doluMap[p.guncel_magaza_id] ?? 0) + 1;
    }
  });
  const magazaEnSonHgoMap: Record<string, number | null> = {};
  const magazaEnSonDonemMap: Record<string, number> = {};
  (performansMagazaListesi ?? []).forEach((s: any) => {
    const donemKodu = s.yil * 100 + s.ay;
    if (!magazaEnSonDonemMap[s.magaza_id] || donemKodu > magazaEnSonDonemMap[s.magaza_id]) {
      magazaEnSonDonemMap[s.magaza_id] = donemKodu;
      magazaEnSonHgoMap[s.magaza_id] = s.hgo;
    }
  });

  // ---- Mağaza bazlı talep sayısı ----
  const magazaTalepSayisiMap: Record<string, number> = {};
  talepler.forEach((t: any) => {
    if (t.magaza_id) magazaTalepSayisiMap[t.magaza_id] = (magazaTalepSayisiMap[t.magaza_id] ?? 0) + 1;
  });

  // ---- Zengin mağaza raporu (Bölge/BM/İK isimleri + talep sayısı dahil) ----
  const magazaRaporVeri = magazalar.map((m) => {
    const bmler = bolgeBmMap[m.bolge_id] ?? [];
    const ikler = bolgeIkMap[m.bolge_id] ?? [];
    return {
      id: m.id, magaza_adi: m.magaza_adi, magaza_kodu: m.magaza_kodu,
      bolge_id: m.bolge_id, bolge_adi: bolgeAdiMap[m.bolge_id] ?? "Tanımsız",
      bm_adi: bmler.map((b) => b.ad_soyad).join(", ") || "—",
      ik_adi: ikler.map((i) => i.ad_soyad).join(", ") || "—",
      norm: normMap[m.id] ?? 0, dolu: doluMap[m.id] ?? 0,
      hgo: magazaEnSonHgoMap[m.id] ?? null,
      talep_sayisi: magazaTalepSayisiMap[m.id] ?? 0,
    };
  });

  // ---- Bölge bazlı talep türü kırılımı (özet tablo için) ----
  const magazaBolgeIdMap: Record<string, string> = {};
  magazaRaporVeri.forEach((m) => { magazaBolgeIdMap[m.id] = m.bolge_id; });
  const bolgeTalepTuruMap: Record<string, Record<string, number>> = {};
  talepler.forEach((t: any) => {
    if (!t.magaza_id) return;
    const bid = magazaBolgeIdMap[t.magaza_id];
    if (!bid) return;
    if (!bolgeTalepTuruMap[bid]) bolgeTalepTuruMap[bid] = {};
    bolgeTalepTuruMap[bid][t.talep_turu] = (bolgeTalepTuruMap[bid][t.talep_turu] ?? 0) + 1;
  });

  // ---- Zengin bölge raporu (İK Sorumlusu - BM sekmesi + Özet Tablo için) ----
  const bolgeRaporVeri = (bolgeler ?? [])
    .filter((b) => magazalar.some((m) => m.bolge_id === b.id) || bolgeBmMap[b.id] || bolgeIkMap[b.id])
    .map((b) => {
      const kendiMagazalari = magazaRaporVeri.filter((m) => m.bolge_id === b.id);
      const hgoDegerleri = kendiMagazalari.filter((m) => m.hgo != null).map((m) => m.hgo as number);
      const turSayaci = bolgeTalepTuruMap[b.id] ?? {};
      return {
        id: b.id, ad: b.ad,
        bm_adi: (bolgeBmMap[b.id] ?? []).map((x) => x.ad_soyad).join(", ") || "—",
        ik_adi: (bolgeIkMap[b.id] ?? []).map((x) => x.ad_soyad).join(", ") || "—",
        magaza_sayisi: kendiMagazalari.length,
        norm: kendiMagazalari.reduce((s, m) => s + m.norm, 0),
        dolu: kendiMagazalari.reduce((s, m) => s + m.dolu, 0),
        hgo: hgoDegerleri.length > 0 ? hgoDegerleri.reduce((s, v) => s + v, 0) / hgoDegerleri.length : null,
        talep_sayisi: kendiMagazalari.reduce((s, m) => s + m.talep_sayisi, 0),
        ise_alim_sayisi: turSayaci["ISE_ALIM"] ?? 0,
        isten_cikarma_sayisi: turSayaci["ISTEN_CIKARMA"] ?? 0,
        rotasyon_sayisi: turSayaci["ROTASYON"] ?? 0,
        norm_degisiklik_sayisi: turSayaci["NORM_DEGISIKLIK"] ?? 0,
      };
    });

  // ---- Talep süreç süresi (mağaza/bölge/BM/İK isimleri dahil) ----
  const KAPANIS_DURUMLARI = ["KABUL_EDILDI", "KAPANDI_RED"];
  const magazaBilgiMap: Record<string, typeof magazaRaporVeri[number]> = {};
  magazaRaporVeri.forEach((m) => { magazaBilgiMap[m.id] = m; });

  const talepSureVeri = talepler.map((t: any) => {
    const acilis = new Date(t.created_at);
    const kapanmisMi = KAPANIS_DURUMLARI.includes(t.durum);
    const bitisTarihi = kapanmisMi ? new Date(t.updated_at) : new Date();
    const sureGun = (bitisTarihi.getTime() - acilis.getTime()) / (1000 * 60 * 60 * 24);
    const magazaBilgi = t.magaza_id ? magazaBilgiMap[t.magaza_id] : null;
    return {
      id: t.id, talep_no: t.talep_no, talep_turu: t.talep_turu, durum: t.durum,
      magaza_id: t.magaza_id, magaza_adi: magazaBilgi?.magaza_adi ?? "—",
      bolge_id: magazaBilgi?.bolge_id ?? null, bolge_adi: magazaBilgi?.bolge_adi ?? "—",
      bm_adi: magazaBilgi?.bm_adi ?? "—", ik_adi: magazaBilgi?.ik_adi ?? "—",
      pozisyon_tipi: t.pozisyon_tipi ?? null,
      sure_gun: Math.round(sureGun * 10) / 10,
      kapanmis_mi: kapanmisMi,
      created_at: t.created_at,
    };
  });

  // ---- Rol bazlı hiyerarşi (Genel sekmesi için) ----
  const magazaVeriBasit = magazaRaporVeri.map((m) => ({ id: m.id, magaza_adi: m.magaza_adi, magaza_kodu: m.magaza_kodu, bolge_id: m.bolge_id, norm: m.norm, dolu: m.dolu, hgo: m.hgo }));

  let hiyerarsi: any = null;
  if (me.rol === "YONETIM") {
    const ikler = Array.from(new Map(atamalar.filter((a) => a.kullanicilar?.rol === "IK" && a.kullanicilar.aktif).map((a) => [a.kullanicilar.id, a.kullanicilar])).values());
    hiyerarsi = {
      tip: "YONETIM",
      ikler: ikler.map((ik: any) => {
        const bolgeIdler = atamalar.filter((a) => a.kullanici_id === ik.id).map((a) => a.bolge_id);
        return {
          id: ik.id, ad_soyad: ik.ad_soyad,
          bolgeler: bolgeIdler.map((bid) => ({
            id: bid, ad: bolgeAdiMap[bid] ?? "?",
            bmler: bolgeBmMap[bid] ?? [],
            magazalar: magazaVeriBasit.filter((m) => m.bolge_id === bid),
          })),
        };
      }),
    };
  } else if (me.rol === "IK") {
    const kendiBolgeIdler = atamalar.filter((a) => a.kullanici_id === me.id).map((a) => a.bolge_id);
    hiyerarsi = {
      tip: "IK",
      bolgeler: kendiBolgeIdler.map((bid) => ({
        id: bid, ad: bolgeAdiMap[bid] ?? "?",
        bmler: bolgeBmMap[bid] ?? [],
        magazalar: magazaVeriBasit.filter((m) => m.bolge_id === bid),
      })),
    };
  } else {
    const kendiBolgeIdler = atamalar.filter((a) => a.kullanici_id === me.id).map((a) => a.bolge_id);
    hiyerarsi = { tip: "BM", magazalar: magazaVeriBasit.filter((m) => kendiBolgeIdler.includes(m.bolge_id)) };
  }

  // ---- İK Personeli Performans Karşılaştırması (sadece Yönetim görür) ----
  let ikPerformans: any = null;
  if (me.rol === "YONETIM") {
    const iklerListesi = Array.from(
      new Map(atamalar.filter((a) => a.kullanicilar?.rol === "IK" && a.kullanicilar.aktif).map((a) => [a.kullanicilar.id, a.kullanicilar])).values()
    ) as { id: string; ad_soyad: string }[];

    const [{ data: onaylarHam }, { data: adaylarHam }] = await Promise.all([
      iklerListesi.length > 0
        ? supabase.from("talep_onaylari").select("onaylayici_kullanici_id, karar").in("onaylayici_kullanici_id", iklerListesi.map((i) => i.id))
        : Promise.resolve({ data: [] as any[] }),
      iklerListesi.length > 0
        ? supabase.from("adaylar").select("yonlendiren_kullanici_id, created_at").in("yonlendiren_kullanici_id", iklerListesi.map((i) => i.id))
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const AY_ANAHTAR = (tarih: string) => {
      const d = new Date(tarih);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    ikPerformans = iklerListesi.map((ik) => {
      const kendiOnaylari = (onaylarHam ?? []).filter((o: any) => o.onaylayici_kullanici_id === ik.id);
      const kendiAdaylari = (adaylarHam ?? []).filter((a: any) => a.yonlendiren_kullanici_id === ik.id);
      const aylikAdaySayisi: Record<string, number> = {};
      kendiAdaylari.forEach((a: any) => {
        const ay = AY_ANAHTAR(a.created_at);
        aylikAdaySayisi[ay] = (aylikAdaySayisi[ay] ?? 0) + 1;
      });
      return {
        id: ik.id, ad_soyad: ik.ad_soyad,
        toplamIs: kendiOnaylari.length,
        bekleyenIs: kendiOnaylari.filter((o: any) => o.karar === null).length,
        toplamAday: kendiAdaylari.length,
        aylikAdaySayisi,
      };
    });
  }

  return (
    <RaporlarClient
      hiyerarsi={hiyerarsi}
      talepSureVeri={talepSureVeri}
      bolgeler={bolgeler ?? []}
      ikPerformans={ikPerformans}
      magazaRaporVeri={magazaRaporVeri}
      bolgeRaporVeri={bolgeRaporVeri}
      benimRolum={me.rol}
    />
  );
}
