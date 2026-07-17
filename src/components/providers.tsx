"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/auth-provider";
import { ConsentProvider } from "@/components/consent-provider";
import { ConsentBanner } from "@/components/consent-banner";
import { GatedAnalytics } from "@/components/gated-analytics";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ConsentProvider>
      <AuthProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <QueryClientProvider client={queryClient}>
            {children}
            <ConsentBanner />
            <GatedAnalytics />
          </QueryClientProvider>
        </ThemeProvider>
      </AuthProvider>
    </ConsentProvider>
  );
}
