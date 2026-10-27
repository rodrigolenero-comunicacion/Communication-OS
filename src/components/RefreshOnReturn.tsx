"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recalcula al volver a la pestaña para no conservar fechas vencidas de otra sesión. Sin polling. */
export function RefreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
  return null;
}
