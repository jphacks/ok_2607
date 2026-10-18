import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Checkpoint } from "@/lib/schemas";
import { QuestProgressScreen } from "./QuestProgressScreen";

// next/navigation のモック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockCheckpoints: Checkpoint[] = [
  {
    id: "cp-1",
    questId: "quest-1",
    parentId: null,
    title: "基本画面が完成している",
    description: "到達すべき状態",
    position: 0,
    isDone: true,
    doneAt: "2026-10-17T00:00:00Z",
  },
  {
    id: "cp-2",
    questId: "quest-1",
    parentId: null,
    title: "主要機能が1つ動作する",
    description: "到達すべき状態",
    position: 1,
    isDone: true,
    doneAt: "2026-10-17T00:00:00Z",
  },
  {
    id: "cp-3",
    questId: "quest-1",
    parentId: null,
    title: "データを保存・読み込みできる",
    description: "到達すべき状態",
    position: 2,
    isDone: false,
    doneAt: null,
  },
];

describe("QuestProgressScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  it("タスクタイトル、進捗テキスト、チェックポイント一覧が正しく表示される", () => {
    render(
      <QuestProgressScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
      />,
    );

    // ヘッダー・見出し
    expect(screen.getByText("✦ TriOne")).toBeInTheDocument();
    expect(screen.getByText("QUEST IN PROGRESS")).toBeInTheDocument();
    expect(screen.getByText("Webアプリを完成させる")).toBeInTheDocument();

    // 進捗（2 / 3）
    expect(screen.getByText(/進捗/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/\/ 3/)).toBeInTheDocument();

    // カード一覧
    expect(screen.getByText("基本画面が完成している")).toBeInTheDocument();
    expect(screen.getByText("主要機能が1つ動作する")).toBeInTheDocument();
    expect(screen.getByText("データを保存・読み込みできる")).toBeInTheDocument();

    // ボタン
    expect(screen.getByRole("button", { name: "クエストを完了する" })).toBeInTheDocument();
  });

  it("チェックボックスをクリックするとトグルされ、進捗表示が更新される", async () => {
    render(
      <QuestProgressScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
      />,
    );

    // 最初は 2 / 3
    expect(screen.getByText("2")).toBeInTheDocument();

    // 未完了の cp-3 をクリック
    const uncheckedCard = screen.getByText("データを保存・読み込みできる");
    fireEvent.click(uncheckedCard);

    // 進捗が 3 / 3 に更新される
    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    // API が呼ばれたことを確認
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/checkpoints/cp-3",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ isDone: true }),
      }),
    );
  });

  it("未完了のチェックポイントがある場合、「クエストを完了する」ボタンは非活性になる", () => {
    const handleComplete = vi.fn();
    render(
      <QuestProgressScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints} // 2/3 完了
        onCompleteQuest={handleComplete}
      />,
    );

    const button = screen.getByRole("button", { name: "クエストを完了する" });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleComplete).not.toHaveBeenCalled();
  });

  it("すべてのチェックポイントが完了しているときのみ「クエストを完了する」ボタンが活性化され、押下できる", async () => {
    const handleComplete = vi.fn();
    const allCompletedCheckpoints: Checkpoint[] = mockCheckpoints.map((cp) => ({
      ...cp,
      isDone: true,
    }));

    render(
      <QuestProgressScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={allCompletedCheckpoints}
        onCompleteQuest={handleComplete}
      />,
    );

    const button = screen.getByRole("button", { name: "クエストを完了する" });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(handleComplete).toHaveBeenCalledTimes(1);
  });

  it("questId が demo の場合は API を呼ばずにローカルでトグルされる", async () => {
    const demoCheckpoints: Checkpoint[] = [
      {
        id: "demo-cp-1",
        questId: "demo",
        parentId: null,
        title: "デモ項目",
        description: null,
        position: 0,
        isDone: false,
        doneAt: null,
      },
    ];

    render(
      <QuestProgressScreen
        questId="demo"
        taskTitle="デモタスク"
        initialCheckpoints={demoCheckpoints}
      />,
    );

    const card = screen.getByText("デモ項目");
    fireEvent.click(card);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
