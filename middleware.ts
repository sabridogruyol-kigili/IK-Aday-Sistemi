// Her istekte oturumu (session) yeniler ve giriş yapmamış kullanıcıyı
// /login'e yönlendirir. Next.js + Supabase SSR entegrasyonunun standart parçası.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // /evrak-portali, adayların personel hesabı olmadan (sadece e-posta ile
  // gönderilen süreli token'la) girdiği herkese açık bir alan — sistem
  // girişinden (bu middleware'in koruduğu alan) tamamen ayrı, buraya hiç
  // yönlendirme uygulanmaz.
  const herkeseAcikYollar = ["/login", "/evrak-portali"];
  const herkeseAcikMi = herkeseAcikYollar.some((yol) => request.nextUrl.pathname.startsWith(yol));

  if (!user && !herkeseAcikMi) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};
