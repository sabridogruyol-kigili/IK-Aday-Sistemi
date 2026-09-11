import EvrakGirisAkisi from "./EvrakGirisAkisi";

export default function EvrakPortaliPage({ params }: { params: { token: string } }) {
  return <EvrakGirisAkisi token={params.token} />;
}
