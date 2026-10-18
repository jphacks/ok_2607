"use client";

import { useSoundEnabled } from "./sound";

export interface SoundToggleProps {
  className?: string;
}

/** 効果音のオン・オフを切り替えるボタン。設定は全画面で共有する */
export function SoundToggle({ className = "" }: SoundToggleProps) {
  const [enabled, setEnabled] = useSoundEnabled();

  return (
    <button
      type="button"
      aria-label="効果音"
      aria-pressed={enabled}
      onClick={() => setEnabled(!enabled)}
      className={`min-h-8 min-w-8 px-1 font-dotgothic text-sm transition-colors active:translate-y-0.5 ${
        enabled ? "text-neon-cyan" : "text-muted"
      } ${className}`}
    >
      <span aria-hidden="true">{enabled ? "♪" : "♪×"}</span>
    </button>
  );
}
