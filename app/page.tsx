import { redirect } from "next/navigation";

// TODO: Auth kurulduğunda burada oturum kontrolü yapılıp
// giriş yoksa /login'e, varsa /dashboard'a yönlendirilecek.
export default function RootPage() {
  redirect("/dashboard");
}
