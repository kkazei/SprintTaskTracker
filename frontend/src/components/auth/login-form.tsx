"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/lib/api/auth";
import { applyServerErrors } from "@/lib/forms";

const schema = z.object({
  email: z.email({ error: "Enter a valid email address" }),
  password: z.string().min(1, { error: "Enter your password" }),
});
type Values = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: "Admin demo", email: "admin@demo.com" },
  { label: "Member demo", email: "member@demo.com" },
] as const;
const DEMO_PASSWORD = "Password123!";

/** Only follow same-site relative paths after login, never an absolute URL (open redirect). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(
    searchParams.get("expired") ? "Your session expired. Please sign in again." : null,
  );

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      await login.mutateAsync(values);
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["email", "password"]));
    }
  }

  function fillDemo(email: string) {
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormError message={formError} />

      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...form.register("email")}
        />
      </FormField>

      <FormField id="password" label="Password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...form.register("password")}
        />
      </FormField>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <div className="bg-muted/60 grid gap-2 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground">
          Try a demo account (password <code className="font-mono">{DEMO_PASSWORD}</code>):
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fillDemo(account.email)}
            >
              {account.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-center text-sm">
        New here?{" "}
        <Link href="/register" className="text-foreground font-medium underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}
