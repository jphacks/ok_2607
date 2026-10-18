"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export interface FloatingTextProps {
  text: string;
  onDone?: () => void;
  className?: string;
}

const REDUCED_MOTION_DURATION_MS = 500;

/** 「+10 XP」のように、その場から飛び出して消える文字。読み上げには含めない */
export function FloatingText({ text, onDone, className = "" }: FloatingTextProps) {
  const reducedMotion = usePrefersReducedMotion();
  const elementRef = useRef<HTMLSpanElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (reducedMotion) {
      const timer = window.setTimeout(() => onDoneRef.current?.(), REDUCED_MOTION_DURATION_MS);
      return () => window.clearTimeout(timer);
    }
    // React の onAnimationEnd は環境によってベンダー接頭辞付きのイベント名になるため、直接購読する
    const element = elementRef.current;
    const handleEnd = () => onDoneRef.current?.();
    element?.addEventListener("animationend", handleEnd);
    return () => element?.removeEventListener("animationend", handleEnd);
  }, [reducedMotion]);

  return (
    <span
      aria-hidden="true"
      ref={elementRef}
      className={`pointer-events-none select-none font-dotgothic font-bold ${
        reducedMotion ? "" : "animate-float-up"
      } ${className}`}
    >
      {text}
    </span>
  );
}
