import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { Task } from "@/lib/api/types";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  useCurrentUser: () => ({ data: { id: 7, full_name: "Max Member", role: "member" } }),
}));

vi.mock("@/lib/api/queries", () => ({
  useUpdateTask: () => ({ mutate: mocks.mutate, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { TaskActions } from "./task-actions";

function makeTask(permissions: Task["permissions"]): Task {
  return {
    id: 42,
    title: "Fix login bug",
    description: null,
    status: "todo",
    priority: "high",
    due_date: null,
    is_overdue: false,
    completed_at: null,
    assignee: null,
    reporter: { id: 1, full_name: "Ada Admin", email: "admin@example.com" },
    sprint: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    permissions,
  };
}

describe("TaskActions", () => {
  it("claims an unassigned task for the current user", async () => {
    const user = userEvent.setup();
    render(<TaskActions task={makeTask({ can_edit: false, can_delete: false, can_claim: true })} onEdit={vi.fn()} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /assign .* to me/i }));

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.mutate.mock.calls[0][0]).toEqual({ id: 42, changes: { assignee_id: 7 } });
  });

  it("shows a read-only lock when the user may not edit or claim the task", () => {
    render(
      <TooltipProvider>
        <TaskActions
          task={makeTask({ can_edit: false, can_delete: false, can_claim: false })}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByLabelText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the action menu and requests an edit", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <TaskActions
        task={makeTask({ can_edit: true, can_delete: true, can_claim: false })}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /actions for/i }));
    await user.click(await screen.findByRole("menuitem", { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
  });
});
