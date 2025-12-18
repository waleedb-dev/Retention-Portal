import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Public_Sans } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardProvider } from "@/components/dashboard-context";
import { CommandPalette } from "@/components/command-palette";
import { NotificationsSlideover } from "@/components/notifications-slideover";
import { supabase } from "@/lib/supabase";

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});
export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  const isAuthPage = router.pathname === "/login";

  useEffect(() => {
    // No auth check needed for the login page
    if (isAuthPage) {
      return;
    }

    let isMounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (!session) {
        router.replace("/login");
      }

      setAuthChecked(true);
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [isAuthPage, router]);

  const isReady = isAuthPage || authChecked;

  if (!isReady) {
    return null;
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <main className={publicSans.variable}>
        <DashboardProvider>
          {isAuthPage ? (
            <Component {...pageProps} />
          ) : (
            <DashboardShell>
              <Component {...pageProps} />
            </DashboardShell>
          )}
          <CommandPalette />
          <NotificationsSlideover />
          <Toaster />
        </DashboardProvider>
      </main>
    </ThemeProvider>
  );
}
