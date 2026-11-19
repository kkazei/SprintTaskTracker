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
import type { Sprint, Task, TaskInput, User } from "@/lib/api/types";
import { useCreateTask, useUpdateTask } from "@/lib/api/queries";
import { applyServerErrors } from "@/lib/forms";
import { PRIORITIES, STATUSES } from "@/lib/task-meta";

const NONE = "none";

const schema = z.object({
  title: z.string().trim().min(1, { error: "Give the task a title" }).max(200),
  description: z.string().trim().max(5000, { error: "Keep it under 5000 characters" }),
  status: z.enum(["todo", "in_progress", "in_review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: z.string(),
  assignee_id: z.string(),
  sprint_id: z.string(),
});
type Values = z.infer<typeof schema>;
const FIELDS = ["title", "description", "status", "priority", "due_date", "assignee_id", "sprint_id"] as const;

function toValues(task?: Task | null): Values {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "todo",
    priority: task?.priority ?? "medium",
    due_date: task?.due_date ?? "",
    assignee_id: task?.assignee ? String(task.assignee.id) : NONE,
    sprint_id: task?.sprint ? String(task.sprint.id) : NONE,
  };
}

function toInput(values: Values): TaskInput {
  return {
    title: values.title,
    description: values.description || null,
    status: values.status,
    priority: values.priority,
    due_date: values.due_date || null,
    assignee_id: values.assignee_id === NONE ? null : Number(values.assignee_id),
    sprint_id: values.sprint_id === NONE ? null : Number(values.sprint_id),
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The task to edit; omit to create a new one. */
  task?: Task | null;
  users: User[];
  sprints: Sprint[];
};

export function TaskFormDialog({ open, onOpenChange, task, users, sprints }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remount per task so the form starts from that task's values. */}
        <TaskForm
          key={task?.id ?? "new"}
          task={task}
          users={users}
          sprints={sprints}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({
  task,
  users,
  sprints,
  onDone,
}: Omit<Props, "open" | "onOpenChange"> & { onDone: () => void }) {
  const isEdit = !!task;
  const create = useCreateTask();
  const update = useUpdateTask();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(task) });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      if (isEdit) {
        await update.mutateAsync({ id: task.id, changes: toInput(values) });
        toast.success("Task updated");
      } else {
        await create.mutateAsync(toInput(values));
        toast.success("Task created");
      }
      onDone();
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, FIELDS));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
        <DialogDescription>
          {isEdit ? "Update the details and save your changes." : "Add a task to the board."}
        </DialogDescription>
      </DialogHeader>

      <FormError message={formError} />

      <FormField id="title" label="Title" error={errors.title?.message}>
        <Input
          id="title"
          autoFocus
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
          {...form.register("title")}
        />
      </FormField>

      <FormField id="description" label="Description" error={errors.description?.message}>
        <Textarea
          id="description"
          rows={3}
          placeholder="Optional details, acceptance criteria, links…"
          aria-invalid={!!errors.description}
          {...form.register("description")}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <ControlledSelect
          form={form}
          name="status"
          label="Status"
          options={STATUSES}
        />
        <ControlledSelect
          form={form}
          name="priority"
          label="Priority"
          options={PRIORITIES}
        />
        <ControlledSelect
          form={form}
          name="assignee_id"
          label="Assignee"
          error={errors.assignee_id?.message}
          options={[
            { value: NONE, label: "Unassigned" },
            ...users.map((user) => ({ value: String(user.id), label: user.full_name })),
          ]}
        />
        <ControlledSelect
          form={form}
          name="sprint_id"
          label="Sprint"
          error={errors.sprint_id?.message}
          options={[
            { value: NONE, label: "Backlog (no sprint)" },
            ...sprints.map((sprint) => ({ value: String(sprint.id), label: sprint.name })),
          ]}
        />
        <FormField id="due_date" label="Due date" error={errors.due_date?.message}>
          <Input
            id="due_date"
            type="date"
            aria-invalid={!!errors.due_date}
            {...form.register("due_date")}
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create task"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ControlledSelect({
  form,
  name,
  label,
  options,
  error,
}: {
  form: ReturnType<typeof useForm<Values>>;
  name: "status" | "priority" | "assignee_id" | "sprint_id";
  label: string;
  options: readonly { value: string; label: string }[];
  error?: string;
}) {
  return (
    <FormField id={name} label={label} error={error}>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={name} className="w-full" aria-invalid={!!error}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </FormField>
  );
}
