"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/lib/api/auth";
import { applyServerErrors } from "@/lib/forms";

// Mirrors the API rules so most mistakes are caught before a round trip.
const schema = z
  .object({
    full_name: z.string().trim().min(1, { error: "Enter your name" }).max(120),
    email: z.email({ error: "Enter a valid email address" }),
    password: z
      .string()
      .min(8, { error: "Use at least 8 characters" })
      .max(72, { error: "Use at most 72 characters" })
      .regex(/[A-Za-z]/, { error: "Include at least one letter" })
      .regex(/\d/, { error: "Include at least one number" }),
    confirm_password: z.string(),
  })
  .refine((values) => values.password === values.confirm_password, {
    error: "Passwords don't match",
    path: ["confirm_password"],
  });
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "", confirm_password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit({ full_name, email, password }: Values) {
    setFormError(null);
    try {
      await register.mutateAsync({ full_name, email, password });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["full_name", "email", "password"]));
    }
  }

  const fields = [
    { name: "full_name", label: "Full name", type: "text", autoComplete: "name" },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    {
      name: "password",
      label: "Password",
      type: "password",
      autoComplete: "new-password",
      hint: "At least 8 characters, with a letter and a number.",
    },
    {
      name: "confirm_password",
      label: "Confirm password",
      type: "password",
      autoComplete: "new-password",
    },
  ] as const;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormError message={formError} />

      {fields.map((field) => {
        const error = errors[field.name]?.message;
        return (
          <FormField
            key={field.name}
            id={field.name}
            label={field.label}
            error={error}
            hint={"hint" in field ? field.hint : undefined}
          >
            <Input
              id={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              aria-invalid={!!error}
              aria-describedby={error ? `${field.name}-error` : undefined}
              {...form.register(field.name)}
            />
          </FormField>
        );
      })}

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground font-medium underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
