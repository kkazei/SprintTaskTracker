import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/api/queries", () => ({
  useCreateTask: () => ({ mutateAsync: mocks.create }),
  useUpdateTask: () => ({ mutateAsync: mocks.update }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

import { TaskFormDialog } from "./task-form-dialog";

const task: Task = {
  id: 9,
  title: "Existing task",
  description: "Old description",
  status: "todo",
  priority: "medium",
  due_date: null,
  is_overdue: false,
  completed_at: null,
  assignee: null,
  reporter: null,
  sprint: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  permissions: { can_edit: true, can_delete: false, can_claim: false },
};

beforeEach(() => {
  mocks.create.mockReset().mockResolvedValue(task);
  mocks.update.mockReset().mockResolvedValue(task);
  mocks.toastSuccess.mockReset();
});

describe("TaskFormDialog", () => {
  it("creates a task with the entered title", async () => {
    const user = userEvent.setup();
    render(
      <TaskFormDialog open onOpenChange={vi.fn()} users={[]} sprints={[]} />,
    );

    await user.type(screen.getByLabelText("Title"), "Write release notes");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      title: "Write release notes",
      status: "todo",
      priority: "medium",
    });
  });

  it("saves edits to an existing task and closes the dialog", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TaskFormDialog
        open
        onOpenChange={onOpenChange}
        task={task}
        users={[]}
        sprints={[]}
      />,
    );

    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Renamed task");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      id: 9,
      changes: { title: "Renamed task" },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not submit a task without a title", async () => {
    const user = userEvent.setup();
    render(
      <TaskFormDialog open onOpenChange={vi.fn()} users={[]} sprints={[]} />,
    );

    await user.click(screen.getByRole("button", { name: "Create task" }));

    expect(await screen.findByText("Give the task a title")).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
