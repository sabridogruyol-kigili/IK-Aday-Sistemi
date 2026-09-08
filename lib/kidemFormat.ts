// Kıdemi "X yıl Y ay" şeklinde okunaklı tek metin olarak gösterir (örn. 27 ay -> "2 yıl 3 ay").
// Ay kısmı her zaman 0-11 arasıdır (12 olduğunda bir üst yıla taşınır).
export function kidemYilAyFormat(kidemAy: number | null | undefined): string {
  if (kidemAy === null || kidemAy === undefined) return "—";
  const yil = Math.floor(kidemAy / 12);
  const ay = kidemAy % 12;
  return `${yil} yıl ${ay} ay`;
}
