"use client";

import React, { useState } from "react";

export interface DebugActionsProps {
  onAddDummyTasks: () => Promise<void>;
  onTriggerUrgentQuest: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function DebugActions({
  onAddDummyTasks,
  onTriggerUrgentQuest,
  disabled = false,
  className = "",
}: DebugActionsProps) {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleAddTasks() {
    setIsPending(true);
    setMessage(null);
    setIsError(false);
    try {
      await onAddDummyTasks();
      setMessage("ダミータスクを追加しました");
    } catch (cause) {
      setIsError(true);
      setMessage(cause instanceof Error ? cause.message : "ダミータスクの追加に失敗しました");
    } finally {
      setIsPending(false);
    }
  }

  async function handleTriggerUrgent() {
    setIsPending(true);
    setMessage(null);
    setIsError(false);
    try {
      await onTriggerUrgentQuest();
      setMessage("緊急クエストを発動しました");
    } catch (cause) {
      setIsError(true);
      setMessage(cause instanceof Error ? cause.message : "緊急クエストの発動に失敗しました");
    } finally {
      setIsPending(false);
    }
  }

  const isButtonDisabled = disabled || isPending;

  return (
    <details
      className={`rounded border border-line-dim bg-panel p-3 text-xs shadow-sm transition-all ${className}`}
    >
      <summary className="cursor-pointer select-none font-bold text-muted transition-colors hover:text-text focus:outline-none">
        🛠 デバッグ操作
      </summary>
      <div className="mt-3 space-y-3 pt-2">
        <p className="text-[11px] leading-relaxed text-muted">
          動作確認・デモ用のショートカット機能です。
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            aria-label="ダミータスクを追加"
            onClick={() => void handleAddTasks()}
            disabled={isButtonDisabled}
            className="flex-1 rounded border border-line bg-panel px-3 py-2 text-center text-xs font-bold text-text transition-colors hover:bg-panel-active disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "追加中…" : "＋ ダミータスクを追加"}
          </button>

          <button
            type="button"
            aria-label="緊急クエストを発動"
            onClick={() => void handleTriggerUrgent()}
            disabled={isButtonDisabled}
            className="flex-1 rounded border border-gold-border bg-panel px-3 py-2 text-center text-xs font-bold text-gold-accent transition-colors hover:bg-panel-active disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "発動中…" : "⚡ 緊急クエストを発動"}
          </button>
        </div>

        {message && (
          <p role="status" className={`text-xs ${isError ? "text-danger" : "text-success"}`}>
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
