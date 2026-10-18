import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(screen.getByText("✦ TriOne")).toBeInTheDocument();
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

  it("isLevelUp が true のとき、レベルアップ通知演出（LEVEL UP!）が表示される", () => {
    render(
      <QuestClearScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        level={2}
        isLevelUp={true}
      />,
    );

    const banner = screen.getByRole("status", { name: "レベルアップ" });
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("LEVEL UP! Lv. 2 に到達！");
  });

  it("isLevelUp が false のとき、レベルアップ通知演出は表示されない", () => {
    render(
      <QuestClearScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        level={1}
        isLevelUp={false}
      />,
    );

    expect(screen.queryByRole("status", { name: "レベルアップ" })).not.toBeInTheDocument();
  });

  describe("登場演出", () => {
    const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
    let animate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      animate = vi.fn(() => ({ finished: new Promise(() => {}), cancel: vi.fn() }));
      Object.defineProperty(HTMLElement.prototype, "animate", {
        value: animate,
        configurable: true,
        writable: true,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      if (originalAnimate) {
        Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "animate");
      }
    });

    it("宝箱とタイトルをポップさせ、紙吹雪を表示する", () => {
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
      render(<QuestClearScreen questId="quest-1" taskTitle="Webアプリを完成させる" />);

      const title = screen.getByText("QUEST CLEAR!");
      const popTargets = animate.mock.contexts;
      expect(popTargets).toContain(title);
      expect(popTargets).toContain(screen.getByLabelText("宝箱").parentElement?.parentElement);
      expect(screen.getByTestId("confetti-burst")).toBeInTheDocument();
    });

    it("動きを減らす設定のときは演出しない", () => {
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
      render(<QuestClearScreen questId="quest-1" taskTitle="Webアプリを完成させる" />);

      expect(animate).not.toHaveBeenCalled();
      expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
    });
  });
});
