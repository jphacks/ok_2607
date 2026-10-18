"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  buildConfettiKeyframes,
  createConfettiParticles,
  type ConfettiParticle,
} from "../confetti";

/** 動きを減らす設定のときは true */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 画面下の左右からクラッカーのように紙吹雪を 1 回だけ放つ演出。音は出さない。
 * 操作を妨げないよう pointer-events-none、読み上げ対象外にするため aria-hidden を付ける。
 */
export function ConfettiBurst() {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);
  const container = useRef<HTMLDivElement>(null);

  // 乱数を使うのでサーバーでは描かず、マウント後に粒子を作る
  useEffect(() => {
    if (prefersReducedMotion()) return;
    setParticles(
      createConfettiParticles({
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    );
  }, []);

  useEffect(() => {
    if (particles.length === 0) return;
    const elements = container.current?.querySelectorAll<HTMLElement>("[data-confetti-id]") ?? [];
    const animations: Animation[] = [];
    elements.forEach((element) => {
      // id は createConfettiParticles が配列の添字と同じ値で振っている
      const particle = particles[Number(element.dataset.confettiId)];
      if (!particle || typeof element.animate !== "function") return;
      animations.push(
        element.animate(buildConfettiKeyframes(particle), {
          duration: particle.duration,
          delay: particle.delay,
          easing: "linear",
          fill: "both",
        }),
      );
    });

    if (animations.length === 0) {
      setParticles([]);
      return;
    }

    let cancelled = false;
    Promise.all(animations.map((animation) => animation.finished))
      .then(() => {
        if (!cancelled) setParticles([]);
      })
      .catch(() => {
        // アンマウントでキャンセルされたときは何もしない
      });

    return () => {
      cancelled = true;
      animations.forEach((animation) => animation.cancel());
    };
  }, [particles]);

  if (particles.length === 0) return null;

  return (
    <div
      ref={container}
      aria-hidden="true"
      data-testid="confetti-burst"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          data-confetti-id={particle.id}
          className={`absolute top-full block opacity-0 ${particle.colorClass}`}
          style={{
            left: particle.originX,
            width: particle.size,
            height: particle.size,
          }}
        />
      ))}
    </div>
  );
}
