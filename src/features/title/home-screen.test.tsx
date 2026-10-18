import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./home-screen";

describe("HomeScreen - クエストの記録とレベル表示", () => {
  const defaultTasks = [
    {
      id: "task-1",
      title: "テストタスク",
      status: "active" as const,
      dueAt: null,
      shownCount: 0,
      skippedCount: 0,
      createdAt: "2026-10-18T00:00:00Z",
      updatedAt: "2026-10-18T00:00:00Z",
    },
  ];

  it("経験値 0 の初期状態では Lv.1、次のレベルまで 50 XP、進捗 0 が表示される", () => {
    render(
      <HomeScreen
        tasks={defaultTasks}
        stats={{ totalXp: 0, completedQuests: 0 }}
        error=""
        onQuest={vi.fn()}
      />,
    );

    expect(screen.getByText("Lv. 1")).toBeInTheDocument();
    expect(screen.getByText("次のLvまで 50 XP")).toBeInTheDocument();
    const progress = screen.getByRole("progressbar", { name: "次のレベルまでの進捗" });
    expect(progress).toHaveAttribute("aria-valuenow", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "50");
    expect(screen.getByText(/EXP\s+0/)).toBeInTheDocument();
    expect(screen.getByText(/クリアしたクエスト\s+0 件/)).toBeInTheDocument();
  });

  it("獲得経験値に応じて正しい Lv. と次のレベルまでの進捗が表示される", () => {
    // 75 XP: Lv.2 (必要 50 XP、現在レベル内 25 XP、次まで 45 XP、枠 70 XP)
    render(
      <HomeScreen
        tasks={defaultTasks}
        stats={{ totalXp: 75, completedQuests: 2 }}
        error=""
        onQuest={vi.fn()}
      />,
    );

    expect(screen.getByText("Lv. 2")).toBeInTheDocument();
    expect(screen.getByText("次のLvまで 45 XP")).toBeInTheDocument();
    const progress = screen.getByRole("progressbar", { name: "次のレベルまでの進捗" });
    expect(progress).toHaveAttribute("aria-valuenow", "25");
    expect(progress).toHaveAttribute("aria-valuemax", "70");
    expect(screen.getByText(/EXP\s+75/)).toBeInTheDocument();
    expect(screen.getByText(/クリアしたクエスト\s+2 件/)).toBeInTheDocument();
  });

  it("stats が null の場合はレベルや進捗バーを表示しない", () => {
    render(<HomeScreen tasks={defaultTasks} stats={null} error="" onQuest={vi.fn()} />);

    expect(screen.queryByText(/Lv\./)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("記録を読み込み中…")).toBeInTheDocument();
  });
});
