import { getPortalVerisi } from "./actions";
import EvrakPortaliClient from "./EvrakPortaliClient";

export default async function EvrakPortaliPage({ params }: { params: { token: string } }) {
  const veri = await getPortalVerisi(params.token);

  if ("error" in veri) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] p-4">
        <div className="bg-white border border-gray-200 rounded-card p-6 max-w-sm w-full text-center">
          <div className="text-sm font-semibold text-danger mb-2">Bağlantı Geçersiz</div>
          <div className="text-xs text-gray-500">{veri.error}</div>
        </div>
      </div>
    );
  }

  return <EvrakPortaliClient token={params.token} veri={veri} />;
}
