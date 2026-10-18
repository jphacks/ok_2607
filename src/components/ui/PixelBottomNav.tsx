"use client";

import React from "react";

export type NavTabId = "tasks" | "quest" | "status";

export interface PixelBottomNavProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  className?: string;
}

function TasksIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      data-testid="tasks-icon"
    >
      <rect x="3" y="4" width="4" height="4" />
      <rect x="9" y="5" width="12" height="2" />
      <rect x="3" y="10" width="4" height="4" />
      <rect x="9" y="11" width="12" height="2" />
      <rect x="3" y="16" width="4" height="4" />
      <rect x="9" y="17" width="12" height="2" />
    </svg>
  );
}

function QuestIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      data-testid="quest-icon"
    >
      {/* 刀身1 (左上から右下) */}
      <rect x="20" y="2" width="2" height="2" />
      <rect x="18" y="4" width="2" height="2" />
      <rect x="16" y="6" width="2" height="2" />
      <rect x="14" y="8" width="2" height="2" />
      <rect x="12" y="10" width="2" height="2" />
      <rect x="10" y="12" width="2" height="2" />
      <rect x="8" y="14" width="2" height="2" />
      {/* 鍔1 */}
      <rect x="6" y="12" width="2" height="4" />
      <rect x="8" y="16" width="4" height="2" />
      {/* 柄1 */}
      <rect x="6" y="16" width="2" height="2" />
      <rect x="4" y="18" width="2" height="2" />
      <rect x="2" y="20" width="2" height="2" />

      {/* 刀身2 (右上から左下) */}
      <rect x="2" y="2" width="2" height="2" />
      <rect x="4" y="4" width="2" height="2" />
      <rect x="6" y="6" width="2" height="2" />
      <rect x="8" y="8" width="2" height="2" />
      <rect x="14" y="14" width="2" height="2" />
      {/* 鍔2 */}
      <rect x="16" y="12" width="2" height="4" />
      <rect x="12" y="16" width="4" height="2" />
      {/* 柄2 */}
      <rect x="16" y="16" width="2" height="2" />
      <rect x="18" y="18" width="2" height="2" />
      <rect x="20" y="20" width="2" height="2" />
    </svg>
  );
}

function StatusIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      data-testid="status-icon"
    >
      <path d="M11 3h2v2h-2V3zm-2 2h6v2H9V5zm-2 2h10v2H7V7zm-2 2h14v2H5V9zm-2 2h18v2H3v-2zm2 2h5v8H5v-8zm9 0h5v8h-5v-8zm-4 0h4v2h-4v-2z" />
    </svg>
  );
}

interface TabItem {
  id: NavTabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabItem[] = [
  {
    id: "tasks",
    label: "タスク",
    icon: <TasksIcon className="h-7 w-7" />,
  },
  {
    id: "quest",
    label: "クエスト",
    icon: <QuestIcon className="h-8 w-8" />,
  },
  {
    id: "status",
    label: "ステータス",
    icon: <StatusIcon className="h-7 w-7" />,
  },
];

export function PixelBottomNav({ currentTab, onSelectTab, className = "" }: PixelBottomNavProps) {
  return (
    <nav
      aria-label="メインメニュー"
      className={`fixed bottom-0 left-1/2 z-20 w-full max-w-[inherit] -translate-x-1/2 bg-panel pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.5)] ${className}`}
    >
      <div className="h-[2px] w-full bg-line-dim" aria-hidden="true" />
      <div className="relative flex h-[72px] items-center justify-around px-2">
        {TABS.map((item) => {
          const isActive = currentTab === item.id;
          const isQuest = item.id === "quest";

          if (isQuest) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab("quest")}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                className="relative -top-3 flex flex-1 flex-col items-center justify-center focus:outline-none"
              >
                <span
                  className={`group relative flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all active:scale-95 ${
                    isActive
                      ? "border-gold bg-gold text-gold-ink shadow-[0_0_16px_rgba(242,198,109,0.6)]"
                      : "border-gold/60 bg-panel text-gold hover:border-gold hover:bg-panel-active"
                  }`}
                >
                  <span className="transition-transform group-hover:scale-110" aria-hidden="true">
                    {item.icon}
                  </span>
                </span>
                <span className="mt-1 flex flex-col items-center text-center">
                  <span
                    className={`font-dotgothic text-base font-bold leading-tight ${
                      isActive ? "text-gold-accent" : "text-text"
                    }`}
                  >
                    {item.label}
                  </span>
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center py-2 transition-colors hover:bg-panel-active/50 ${
                isActive ? "text-gold-accent" : "text-muted hover:text-text"
              }`}
            >
              <span className="flex items-center justify-center leading-none" aria-hidden="true">
                {item.icon}
              </span>
              <span className="mt-1 font-dotgothic text-sm font-bold md:text-base">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
