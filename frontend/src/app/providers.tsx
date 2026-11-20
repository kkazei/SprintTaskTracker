"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useRouter } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/client";

function isSessionExpired(error: Error): boolean {
  return error instanceof ApiError && error.status === 401;
}

function makeQueryClient(navigate: (url: string) => void) {
  const onError = (error: Error) => {
    // The BFF clears the cookie when the API rejects the token; send the user back to login.
    // Several queries can fail at once; replacing to the same URL repeatedly is harmless.
    if (!isSessionExpired(error) || window.location.pathname === "/login") return;
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    navigate(`/login?next=${next}&expired=1`);
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Don't retry client errors (401/403/404/422); they won't succeed on a retry.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => makeQueryClient((url) => router.replace(url)));

  return (
    // Theme follows the OS by default; the choice is stored in localStorage by next-themes.
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* Respect the OS "reduce motion" setting for every Motion / Magic UI animation. */}
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
