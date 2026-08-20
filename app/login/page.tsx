// TODO: Supabase Auth (Email OTP) burada kurulacak.
// Kurumsal domain kısıtlaması ve giriş formu bu sayfada olacak.

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-3">
      <div className="bg-white rounded-card p-8 w-[380px]">
        <div className="w-[34px] h-[34px] bg-accent rounded-[7px] flex items-center justify-center font-bold text-xs text-navy-3 mb-4">
          QHR
        </div>
        <div className="text-lg font-semibold text-navy-3 mb-1">Giriş Yap</div>
        <div className="text-xs text-gray-400 mb-5">Kurumsal e-posta adresinizle devam edin</div>
        <input
          type="email"
          placeholder="ad.soyad@sirketiniz.com"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
        />
        <button className="w-full bg-navy text-white rounded-md py-2 text-sm font-medium">
          Kod Gönder
        </button>
      </div>
    </div>
  );
}
