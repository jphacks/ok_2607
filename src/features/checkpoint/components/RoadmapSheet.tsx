"use client";

import React, { useEffect, useRef } from "react";
import type { Checkpoint } from "@/lib/schemas";
import { childCheckpointsOf, computeCheckpointFocus } from "../order";

interface RoadmapSheetProps {
  open: boolean;
  onClose: () => void;
  taskTitle: string;
  checkpoints: Checkpoint[];
}

const STATE_ICON = { done: "✓", current: "▶", locked: "🔒" } as const;

/**
 * クエスト全体のロードマップ（マイルストーンとステップ）を下から引き出して見せる。
 * 見るだけで、チェック操作は進行画面の「今やること」で行う。
 */
export function RoadmapSheet({ open, onClose, taskTitle, checkpoints }: RoadmapSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const { steps, completedCount, totalCount } = computeCheckpointFocus(checkpoints);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div aria-hidden="true" className="absolute inset-0 bg-surface/80" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="roadmap-heading"
        className="relative flex max-h-[80dvh] w-full max-w-3xl flex-col border-t-4 border-gold-accent bg-panel font-dotgothic text-text"
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 id="roadmap-heading" className="text-base font-bold text-gold-accent">
              ロードマップ
            </h2>
            <p className="mt-0.5 line-clamp-1 text-xs break-all text-muted">
              {taskTitle}（{completedCount} / {totalCount} マイルストーン）
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="ロードマップを閉じる"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center text-xl text-muted hover:text-text"
          >
            ✕
          </button>
        </header>

        <ol className="flex-1 space-y-3 overflow-y-auto border-t border-line-dim px-5 py-4">
          {steps.map(({ checkpoint, state }, index) => {
            const children = childCheckpointsOf(checkpoints, checkpoint.id);
            return (
              <li
                key={checkpoint.id}
                data-state={state}
                aria-current={state === "current" ? "step" : undefined}
                className={
                  state === "current"
                    ? "border-2 border-gold-accent bg-panel-active p-3"
                    : `px-3 ${state === "done" ? "opacity-70" : "opacity-50"}`
                }
              >
                <p className="flex items-start gap-2 text-sm font-bold">
                  <span
                    aria-hidden="true"
                    className="w-4 flex-shrink-0 text-center text-gold-accent"
                  >
                    {STATE_ICON[state]}
                  </span>
                  <span className="min-w-0 flex-1 break-words">
                    <span className="sr-only">
                      {state === "done"
                        ? "完了: "
                        : state === "current"
                          ? "今やること: "
                          : "未着手: "}
                    </span>
                    マイルストーン {index + 1}: {checkpoint.title}
                  </span>
                </p>
                {children.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-6 text-xs text-muted">
                    {children.map((child) => (
                      <li key={child.id} className="break-words">
                        ・{child.title}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
