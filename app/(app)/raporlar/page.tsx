import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RaporlarClient from "./RaporlarClient";

// Supabase tek sorguda en fazla 1000 satır döndürür.
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
  // Mağazalar Direktörlüğü'nün bu sayfaya hiç erişimi yok.
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
            .order("yil")
            .order("ay")
            .range(bas, bitis)
        )
      : Promise.resolve([]),
    tumSatirlariGetir<any>((bas, bitis) =>
      supabase
        .from("talepler")
        .select("id, talep_no, talep_turu, durum, magaza_id, acan_rol, created_at, updated_at")
        .range(bas, bitis)
    ),
  ]);

  // ---- Bölge -> BM / İK haritası ----
  const bolgeBmMap: Record<string, { id: string; ad_soyad: string }[]> = {};
  const bolgeIkMap: Record<string, { id: string; ad_soyad: string }[]> = {};
  atamalar.forEach((a) => {
    const k = a.kullanicilar;
    if (!k?.aktif) return;
    if (k.rol === "BM") bolgeBmMap[a.bolge_id] = [...(bolgeBmMap[a.bolge_id] ?? []), { id: k.id, ad_soyad: k.ad_soyad }];
    if (k.rol === "IK") bolgeIkMap[a.bolge_id] = [...(bolgeIkMap[a.bolge_id] ?? []), { id: k.id, ad_soyad: k.ad_soyad }];
  });

  // ---- Norm / doluluk / HGO (mağaza bazlı) ----
  const normMap: Record<string, number> = {};
  (normRes.data ?? []).forEach((n: any) => {
    normMap[n.magaza_id] = (n.ana_kadro_norm ?? 0) + (n.donemsel_norm ?? 0) + (n.part_time_norm ?? 0);
  });
  const doluMap: Record<string, number> = {};
  const hgoToplamMap: Record<string, { toplam: number; sayi: number }> = {};
  (personelListesi ?? []).forEach((p: any) => {
    if (["ANA_KADRO", "DONEMSEL", "PART_TIME"].includes(p.kadro_kategorisi)) {
      doluMap[p.guncel_magaza_id] = (doluMap[p.guncel_magaza_id] ?? 0) + 1;
    }
    if (p.performans_ortalama_hgo != null) {
      if (!hgoToplamMap[p.guncel_magaza_id]) hgoToplamMap[p.guncel_magaza_id] = { toplam: 0, sayi: 0 };
      hgoToplamMap[p.guncel_magaza_id].toplam += p.performans_ortalama_hgo;
      hgoToplamMap[p.guncel_magaza_id].sayi += 1;
    }
  });

  // Mağazanın kendi (mağaza bazlı) en son HGO'su — kişi ortalaması değil, mağaza HGO'su.
  const magazaEnSonHgoMap: Record<string, { yil: number; ay: number; hgo: number | null }> = {};
  (performansMagazaListesi ?? []).forEach((s: any) => {
    const mevcut = magazaEnSonHgoMap[s.magaza_id];
    if (!mevcut || s.yil * 100 + s.ay > mevcut.yil * 100 + mevcut.ay) {
      magazaEnSonHgoMap[s.magaza_id] = { yil: s.yil, ay: s.ay, hgo: s.hgo };
    }
  });

  const magazaVeri = magazalar.map((m) => ({
    id: m.id, magaza_adi: m.magaza_adi, magaza_kodu: m.magaza_kodu, bolge_id: m.bolge_id,
    norm: normMap[m.id] ?? 0, dolu: doluMap[m.id] ?? 0,
    hgo: magazaEnSonHgoMap[m.id]?.hgo ?? null,
  }));

  // ---- Talep süreç süresi ----
  const KAPANIS_DURUMLARI = ["KABUL_EDILDI", "KAPANDI_RED"];
  const magazaBolgeMap: Record<string, string> = {};
  magazalar.forEach((m) => { magazaBolgeMap[m.id] = m.bolge_id; });

  const talepSureVeri = talepler.map((t: any) => {
    const acilis = new Date(t.created_at);
    const kapanmisMi = KAPANIS_DURUMLARI.includes(t.durum);
    const bitisTarihi = kapanmisMi ? new Date(t.updated_at) : new Date();
    const sureGun = (bitisTarihi.getTime() - acilis.getTime()) / (1000 * 60 * 60 * 24);
    return {
      id: t.id, talep_no: t.talep_no, talep_turu: t.talep_turu, durum: t.durum,
      bolge_id: magazaBolgeMap[t.magaza_id] ?? null,
      sure_gun: Math.round(sureGun * 10) / 10,
      kapanmis_mi: kapanmisMi,
      created_at: t.created_at,
    };
  });

  // ---- Rol bazlı hiyerarşi kurulumu ----
  // Yönetim: her İK -> o İK'nın bölgeleri -> her bölgenin BM'i + mağazaları
  // İK: sadece kendi bölgeleri -> BM + mağazalar
  // BM: sadece kendi bölgesi/mağazaları (düz liste)
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
            id: bid,
            ad: bolgeler?.find((b) => b.id === bid)?.ad ?? "?",
            bmler: bolgeBmMap[bid] ?? [],
            magazalar: magazaVeri.filter((m) => m.bolge_id === bid),
          })),
        };
      }),
    };
  } else if (me.rol === "IK") {
    const kendiBolgeIdler = atamalar.filter((a) => a.kullanici_id === me.id).map((a) => a.bolge_id);
    hiyerarsi = {
      tip: "IK",
      bolgeler: kendiBolgeIdler.map((bid) => ({
        id: bid,
        ad: bolgeler?.find((b) => b.id === bid)?.ad ?? "?",
        bmler: bolgeBmMap[bid] ?? [],
        magazalar: magazaVeri.filter((m) => m.bolge_id === bid),
      })),
    };
  } else {
    // BM
    const kendiBolgeIdler = atamalar.filter((a) => a.kullanici_id === me.id).map((a) => a.bolge_id);
    hiyerarsi = {
      tip: "BM",
      magazalar: magazaVeri.filter((m) => kendiBolgeIdler.includes(m.bolge_id)),
    };
  }

  return (
    <RaporlarClient
      hiyerarsi={hiyerarsi}
      talepSureVeri={talepSureVeri}
      bolgeler={bolgeler ?? []}
    />
  );
}
