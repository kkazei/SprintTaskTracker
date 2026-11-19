import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <div className="mb-6 grid gap-1">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-muted-foreground text-sm">
          New accounts join as members. An admin can grant admin access later.
        </p>
      </div>
      <RegisterForm />
    </>
  );
}
