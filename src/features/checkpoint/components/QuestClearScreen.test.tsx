import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QuestClearScreen } from "./QuestClearScreen";

// next/navigation のモック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("QuestClearScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("クリアタイトル、宝箱、リザルトカード（タスク名、進捗、獲得XP）が正しく表示される", () => {
    render(
      <QuestClearScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        completedCheckpointsCount={5}
        totalCheckpointsCount={5}
        xpGained={120}
        nextLevelXp={80}
        level={4}
      />,
    );

    // ヘッダー & 見出し
    expect(screen.getByText("✦ TODO ROGUE")).toBeInTheDocument();
    expect(screen.getByText("QUEST CLEAR!")).toBeInTheDocument();
    expect(screen.getByText("クエスト達成！")).toBeInTheDocument();

    // 宝箱ピクセルアート
    expect(screen.getByLabelText("宝箱")).toBeInTheDocument();

    // リザルトカード
    expect(screen.getByText("Webアプリを完成させる")).toBeInTheDocument();
    expect(screen.getByText(/チェックポイント 5 \/ 5/)).toBeInTheDocument();
    expect(screen.getByText("＋ 120 XP")).toBeInTheDocument();
    expect(screen.getByText("次のレベルまであと 80 XP")).toBeInTheDocument();

    // ボタン & ホームリンク
    expect(screen.getByRole("button", { name: "次の冒険へ" })).toBeInTheDocument();
    const homeLink = screen.getByRole("link", { name: "ホームに戻る" });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("「次の冒険へ」ボタンをクリックすると onNextQuest が呼ばれる", () => {
    const handleNextQuest = vi.fn();
    render(
      <QuestClearScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        onNextQuest={handleNextQuest}
      />,
    );

    const button = screen.getByRole("button", { name: "次の冒険へ" });
    fireEvent.click(button);

    expect(handleNextQuest).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("onNextQuest が未指定の場合、「次の冒険へ」ボタンをクリックすると router.push('/') が呼ばれる", () => {
    render(<QuestClearScreen questId="quest-1" taskTitle="Webアプリを完成させる" />);

    const button = screen.getByRole("button", { name: "次の冒険へ" });
    fireEvent.click(button);

    expect(mockPush).toHaveBeenCalledWith("/");
  });
});
