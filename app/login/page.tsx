"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    setError("");
    setLoading(true);

    const { data: isRegistered, error: checkError } = await supabase.rpc(
      "is_registered_user",
      { check_email: email.trim().toLowerCase() }
    );

    if (checkError || !isRegistered) {
      setError("Bu e-posta adresi sistemde kayıtlı değil. Yönetim ile iletişime geçin.");
      setLoading(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });

    if (otpError) {
      setError("Kod gönderilemedi: " + otpError.message);
      setLoading(false);
      return;
    }

    setStep("code");
    setLoading(false);
  }

  async function handleVerifyCode() {
    setError("");
    setLoading(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });

    if (verifyError) {
      setError("Kod hatalı veya süresi dolmuş.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-3">
      <div className="bg-white rounded-card p-8 w-[380px]">
        <div className="w-[34px] h-[34px] bg-accent rounded-[7px] flex items-center justify-center font-bold text-xs text-navy-3 mb-4">
          QHR
        </div>
        <div className="text-lg font-semibold text-navy-3 mb-1">Giriş Yap</div>
        <div className="text-xs text-gray-400 mb-5">
          {step === "email"
            ? "Kurumsal e-posta adresinizle devam edin"
            : `${email} adresine gönderilen kodu girin`}
        </div>

        {error && (
          <div className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2 mb-3">
            {error}
          </div>
        )}

        {step === "email" ? (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ad.soyad@sirketiniz.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
            />
            <button
              onClick={handleSendCode}
              disabled={loading || !email}
              className="w-full bg-navy text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Gönderiliyor..." : "Kod Gönder"}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="8 haneli kod"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
            />
            <button
              onClick={handleVerifyCode}
              disabled={loading || !code}
              className="w-full bg-navy text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Doğrulanıyor..." : "Giriş Yap"}
            </button>
            <button
              onClick={() => setStep("email")}
              className="w-full text-xs text-gray-400 mt-3"
            >
              E-postayı değiştir
            </button>
          </>
        )}
      </div>
    </div>
  );
}
