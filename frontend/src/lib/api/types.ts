// Mirrors the FastAPI schemas (see backend/app/schemas and /docs).

export type UserRole = "admin" | "member";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type SprintStatus = "planned" | "active" | "completed";

export type PageMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type FieldError = {
  field: string;
  location: string;
  message: string;
  type: string;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta: PageMeta | null;
  error: { code: string; message: string; details: FieldError[] | null } | null;
};

export type UserSummary = {
  id: number;
  full_name: string;
  email: string;
};

export type User = UserSummary & {
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export type SprintSummary = {
  id: number;
  name: string;
  status: SprintStatus;
};

export type Sprint = SprintSummary & {
  goal: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  task_count: number;
  completed_task_count: number;
};

export type Task = {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  is_overdue: boolean;
  completed_at: string | null;
  assignee: UserSummary | null;
  reporter: UserSummary | null;
  sprint: SprintSummary | null;
  created_at: string;
  updated_at: string;
  permissions: { can_edit: boolean; can_delete: boolean; can_claim: boolean };
};

export type TaskInput = {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: number | null;
  sprint_id: number | null;
};

export type TaskSummary = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  due_soon: number;
  unassigned: number;
  completion_rate: number;
  by_status: Record<TaskStatus, number>;
  by_priority: Record<TaskPriority, number>;
};

export type SprintInput = {
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  status: SprintStatus;
};
