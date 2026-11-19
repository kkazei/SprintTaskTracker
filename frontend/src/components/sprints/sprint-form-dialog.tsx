"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Sprint, SprintInput } from "@/lib/api/types";
import { useCreateSprint, useUpdateSprint } from "@/lib/api/queries";
import { applyServerErrors } from "@/lib/forms";
import { SPRINT_STATUSES } from "@/lib/task-meta";

// Dates are YYYY-MM-DD strings, so string comparison orders them correctly.
const schema = z
  .object({
    name: z.string().trim().min(1, { error: "Give the sprint a name" }).max(120),
    goal: z.string().trim().max(2000, { error: "Keep it under 2000 characters" }),
    start_date: z.string().min(1, { error: "Pick a start date" }),
    end_date: z.string().min(1, { error: "Pick an end date" }),
    status: z.enum(["planned", "active", "completed"]),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    error: "End date must be on or after the start date",
    path: ["end_date"],
  });
type Values = z.infer<typeof schema>;
const FIELDS = ["name", "goal", "start_date", "end_date", "status"] as const;

/** YYYY-MM-DD in the user's own timezone (toISOString would use UTC and can be off by a day). */
function localIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toValues(sprint?: Sprint | null): Values {
  const today = new Date();
  const twoWeeks = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 13);
  return {
    name: sprint?.name ?? "",
    goal: sprint?.goal ?? "",
    start_date: sprint?.start_date ?? localIsoDate(today),
    end_date: sprint?.end_date ?? localIsoDate(twoWeeks),
    status: sprint?.status ?? "planned",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint?: Sprint | null;
};

export function SprintFormDialog({ open, onOpenChange, sprint }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <SprintForm key={sprint?.id ?? "new"} sprint={sprint} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SprintForm({ sprint, onDone }: { sprint?: Sprint | null; onDone: () => void }) {
  const isEdit = !!sprint;
  const create = useCreateSprint();
  const update = useUpdateSprint();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(sprint) });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);
    const input: SprintInput = { ...values, goal: values.goal || null };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: sprint.id, changes: input });
        toast.success("Sprint updated");
      } else {
        await create.mutateAsync(input);
        toast.success("Sprint created");
      }
      onDone();
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, FIELDS));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit sprint" : "New sprint"}</DialogTitle>
        <DialogDescription>
          {isEdit ? "Update the sprint's details." : "Plan the next iteration for your team."}
        </DialogDescription>
      </DialogHeader>

      <FormError message={formError} />

      <FormField id="sprint-name" label="Name" error={errors.name?.message}>
        <Input
          id="sprint-name"
          autoFocus
          placeholder="Sprint 5 - Launch"
          aria-invalid={!!errors.name}
          {...form.register("name")}
        />
      </FormField>

      <FormField id="sprint-goal" label="Goal" error={errors.goal?.message}>
        <Textarea
          id="sprint-goal"
          rows={2}
          placeholder="What should this sprint achieve?"
          aria-invalid={!!errors.goal}
          {...form.register("goal")}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="sprint-start" label="Start date" error={errors.start_date?.message}>
          <Input
            id="sprint-start"
            type="date"
            aria-invalid={!!errors.start_date}
            {...form.register("start_date")}
          />
        </FormField>
        <FormField id="sprint-end" label="End date" error={errors.end_date?.message}>
          <Input
            id="sprint-end"
            type="date"
            aria-invalid={!!errors.end_date}
            {...form.register("end_date")}
          />
        </FormField>
        <FormField id="sprint-status" label="Status">
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="sprint-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPRINT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create sprint"}
        </Button>
      </DialogFooter>
    </form>
  );
}
