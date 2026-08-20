// Sunucu (server component / route handler) tarafında kullanılacak Supabase istemcisi.
// Kullanıcının oturum çerezini (cookie) okuyarak RLS politikalarının doğru çalışmasını sağlar.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component içinden çağrılırsa (route handler değilse) sessizce yok say.
          }
        },
      },
    }
  );
}
