"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { request } from "@/lib/api/client";
import type {
  Sprint,
  SprintInput,
  Task,
  TaskInput,
  TaskPriority,
  TaskStatus,
  TaskSummary,
  User,
  UserRole,
} from "@/lib/api/types";
import { meQueryKey } from "@/lib/api/auth";
import { BACKEND_PROXY_PATH as API } from "@/lib/constants";

export type TaskListParams = {
  q?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: number;
  unassigned?: boolean;
  reporter_id?: number;
  sprint_id?: number;
  overdue?: boolean;
  due_soon?: boolean;
  sort?: string;
  page?: number;
  page_size?: number;
};

export type SummaryScope = Pick<
  TaskListParams,
  "assignee_id" | "unassigned" | "reporter_id" | "sprint_id"
>;

export const queryKeys = {
  tasks: ["tasks"] as const,
  taskList: (params: TaskListParams) => ["tasks", "list", params] as const,
  summary: (scope: SummaryScope) => ["tasks", "summary", scope] as const,
  users: ["users"] as const,
  sprints: ["sprints"] as const,
};

export function useTasks(params: TaskListParams, { enabled = true } = {}) {
  return useQuery({
    enabled,
    queryKey: queryKeys.taskList(params),
    queryFn: ({ signal }) => request<Task[]>(`${API}/tasks`, { params, signal }),
    // Keep showing the current page while the next page or filter loads (no flash of empty).
    placeholderData: keepPreviousData,
  });
}

export function useTaskSummary(scope: SummaryScope, { enabled = true } = {}) {
  return useQuery({
    enabled,
    queryKey: queryKeys.summary(scope),
    queryFn: async ({ signal }) =>
      (await request<TaskSummary>(`${API}/tasks/summary`, { params: scope, signal })).data,
    placeholderData: keepPreviousData,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async ({ signal }) =>
      (await request<User[]>(`${API}/users`, { params: { page_size: 100 }, signal })).data,
    staleTime: 5 * 60_000,
  });
}

export function useSprints() {
  return useQuery({
    queryKey: queryKeys.sprints,
    queryFn: async ({ signal }) =>
      (await request<Sprint[]>(`${API}/sprints`, { params: { page_size: 100 }, signal })).data,
    staleTime: 60_000,
  });
}

/** Task changes affect lists, metrics and sprint progress, so refresh all of them. */
function useInvalidateTaskData() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints }),
    ]);
}

export function useCreateTask() {
  const invalidate = useInvalidateTaskData();
  return useMutation({
    mutationFn: async (input: TaskInput) =>
      (await request<Task>(`${API}/tasks`, { method: "POST", body: input })).data,
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTaskData();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: number; changes: Partial<TaskInput> }) =>
      (await request<Task>(`${API}/tasks/${id}`, { method: "PATCH", body: changes })).data,
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTaskData();
  return useMutation({
    mutationFn: async (id: number) => {
      await request<{ id: number }>(`${API}/tasks/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: invalidate,
  });
}

export function useCreateSprint() {
  const invalidate = useInvalidateTaskData();
  return useMutation({
    mutationFn: async (input: SprintInput) =>
      (await request<Sprint>(`${API}/sprints`, { method: "POST", body: input })).data,
    onSuccess: invalidate,
  });
}

export function useUpdateSprint() {
  const invalidate = useInvalidateTaskData();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: number; changes: Partial<SprintInput> }) =>
      (await request<Sprint>(`${API}/sprints/${id}`, { method: "PATCH", body: changes })).data,
    // Sprint names and statuses are embedded in tasks, so refresh both.
    onSuccess: invalidate,
  });
}

export function useDeleteSprint() {
  const invalidate = useInvalidateTaskData();
  return useMutation({
    mutationFn: async (id: number) => {
      await request<{ id: number }>(`${API}/sprints/${id}`, { method: "DELETE" });
      return id;
    },
    // Its tasks move to the backlog, so task lists and metrics change too.
    onSuccess: invalidate,
  });
}

export function useChangeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: number; role: UserRole }) =>
      (await request<User>(`${API}/users/${id}/role`, { method: "PATCH", body: { role } })).data,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.users }),
        queryClient.invalidateQueries({ queryKey: meQueryKey }),
        // Per-task permissions depend on roles.
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
      ]),
  });
}
