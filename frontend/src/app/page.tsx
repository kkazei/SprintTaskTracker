import { redirect } from "next/navigation";

// The proxy normally redirects "/" before this renders; this is the fallback.
export default function Home() {
  redirect("/dashboard");
}
