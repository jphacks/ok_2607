"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(QUERY);
}

function subscribe(onChange: () => void): () => void {
  const mediaQuery = getMediaQuery();
  mediaQuery?.addEventListener("change", onChange);
  return () => mediaQuery?.removeEventListener("change", onChange);
}

/**
 * OS で視差効果（動き）の低減を指定しているかを返す。
 * CSS のアニメーションは globals.css の全体ルールで止まるので、JS で動かす演出を止めるときに使う。
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getMediaQuery()?.matches ?? false,
    () => false,
  );
}
