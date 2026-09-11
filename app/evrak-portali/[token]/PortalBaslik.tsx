// Evrak portalının tüm ekranlarında (e-posta girişi, kod doğrulama, KVKK,
// ana portal) aynı şekilde kullanılan üst logo — tek yerden yönetilir.
export default function PortalBaslik() {
  return (
    <div className="flex justify-center mb-5">
      <img src="/logo2.png" alt="Kiğılı" className="h-16 w-auto" />
    </div>
  );
}
