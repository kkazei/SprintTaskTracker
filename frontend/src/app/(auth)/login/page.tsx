import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <div className="mb-6 grid gap-1">
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to see your team&apos;s board.</p>
      </div>
      {/* The form reads ?next= and ?expired= from the URL, which happens at request time. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
