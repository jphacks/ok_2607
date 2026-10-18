"use client";

import React from "react";

export type NavTabId = "tasks" | "quest" | "status";

export interface PixelBottomNavProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  className?: string;
}

interface TabItem {
  id: NavTabId;
  label: string;
  subLabel?: string;
  icon: string;
}

const TABS: TabItem[] = [
  {
    id: "tasks",
    label: "タスク",
    icon: "☷",
  },
  {
    id: "quest",
    label: "クエスト",
    subLabel: "クエストを開始",
    icon: "⚔",
  },
  {
    id: "status",
    label: "ステータス",
    icon: "⌂",
  },
];

export function PixelBottomNav({ currentTab, onSelectTab, className = "" }: PixelBottomNavProps) {
  return (
    <nav
      aria-label="メインメニュー"
      className={`fixed bottom-0 left-1/2 z-20 w-full max-w-[390px] -translate-x-1/2 bg-panel pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.5)] ${className}`}
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
                aria-label={`${item.label}（${item.subLabel}）`}
                className="relative -top-3 flex flex-1 flex-col items-center justify-center focus:outline-none"
              >
                <span
                  className={`group relative flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all active:scale-95 ${
                    isActive
                      ? "border-gold bg-gold text-gold-ink shadow-[0_0_16px_rgba(242,198,109,0.6)]"
                      : "border-gold/60 bg-panel text-gold hover:border-gold hover:bg-panel-active"
                  }`}
                >
                  <span
                    className="text-2xl transition-transform group-hover:scale-110"
                    aria-hidden="true"
                  >
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
                  {item.subLabel && (
                    <span
                      className={`text-[10px] font-medium leading-none tracking-tight ${
                        isActive ? "text-gold" : "text-muted"
                      }`}
                    >
                      {item.subLabel}
                    </span>
                  )}
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
              <span className="text-lg leading-none" aria-hidden="true">
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
