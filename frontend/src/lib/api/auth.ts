"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { request } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { BACKEND_PROXY_PATH } from "@/lib/constants";

export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { full_name: string };

export const meQueryKey = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async ({ signal }) => (await request<User>(`${BACKEND_PROXY_PATH}/auth/me`, { signal })).data,
    staleTime: 5 * 60_000,
  });
}

const noopSubscribe = () => () => {};

/** False during server render and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * The current user's role, or `undefined` until it is known on the client.
 *
 * Role-dependent UI must not render during hydration: the header may already have fetched
 * the user, which would make the client's first render differ from the server HTML.
 * The API enforces every rule regardless; this only decides what to show.
 */
export function useRole() {
  const hydrated = useHydrated();
  const { data: user } = useCurrentUser();
  return hydrated ? user?.role : undefined;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) =>
      (await request<{ user: User }>("/api/auth/login", { method: "POST", body: input })).data.user,
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterInput) =>
      (await request<{ user: User }>("/api/auth/register", { method: "POST", body: input })).data
        .user,
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => request<null>("/api/auth/logout", { method: "POST" }),
    onSettled: () => {
      router.replace("/login");
      router.refresh();
      queryClient.clear();
    },
  });
}
