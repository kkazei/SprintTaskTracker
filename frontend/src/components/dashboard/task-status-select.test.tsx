import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Task } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api/queries", () => ({
  useUpdateTask: () => ({ mutate: mocks.mutate, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { TaskStatusSelect } from "./task-status-select";

function makeTask(canEdit: boolean): Task {
  return {
    id: 5,
    title: "Ship the release",
    description: null,
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
    permissions: { can_edit: canEdit, can_delete: false, can_claim: false },
  };
}

describe("TaskStatusSelect", () => {
  it("renders a plain label when the user cannot edit the task", () => {
    render(<TaskStatusSelect task={makeTask(false)} />);

    expect(screen.getByText("To do")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("updates the task when a new status is picked", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<TaskStatusSelect task={makeTask(true)} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Done" }));

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.mutate.mock.calls[0][0]).toEqual({ id: 5, changes: { status: "done" } });
  });

  it("surfaces a failed status change as an error toast", async () => {
    mocks.mutate.mockImplementation(
      (_vars: unknown, options: { onError: (error: Error) => void }) =>
        options.onError(new Error("Status update failed")),
    );
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<TaskStatusSelect task={makeTask(true)} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "In progress" }));

    expect(mocks.toastError).toHaveBeenCalledWith("Status update failed");
  });
});
