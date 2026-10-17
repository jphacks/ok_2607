import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Checkpoint } from "@/lib/schemas";
import { CheckpointGenerationScreen } from "./CheckpointGenerationScreen";

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
    isDone: false,
    doneAt: null,
  },
  {
    id: "cp-2",
    questId: "quest-1",
    parentId: null,
    title: "主要機能が1つ動作する",
    description: "到達すべき状態",
    position: 1,
    isDone: false,
    doneAt: null,
  },
  {
    id: "cp-sub-1",
    questId: "quest-1",
    parentId: "cp-1", // 子チェックポイント（全体像一覧には表示されない）
    title: "子タスク1",
    description: null,
    position: 0,
    isDone: false,
    doneAt: null,
  },
];

describe("CheckpointGenerationScreen", () => {
  it("タスク名、タイトル、チェックポイント一覧が正しく表示される", () => {
    render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
      />,
    );

    // ヘッダー・見出し
    expect(screen.getByText("✦ TODO ROGUE")).toBeInTheDocument();
    expect(screen.getByText("AIが冒険の道筋を描く")).toBeInTheDocument();
    expect(screen.getByText("MAIN QUEST")).toBeInTheDocument();
    expect(screen.getByText("Webアプリを完成させる")).toBeInTheDocument();

    // 親チェックポイントのみが表示される（子チェックポイントは除外）
    expect(screen.getByText("基本画面が完成している")).toBeInTheDocument();
    expect(screen.getByText("主要機能が1つ動作する")).toBeInTheDocument();
    expect(screen.queryByText("子タスク1")).not.toBeInTheDocument();

    // 番号プレフィックス
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();

    // 注釈
    expect(screen.getByText(/AIが提案したチェックポイントは編集できます/)).toBeInTheDocument();
  });

  it("「クエストを開始する」ボタンを押すと onStartQuest または router.push が呼ばれる", () => {
    const handleStart = vi.fn();
    render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
        onStartQuest={handleStart}
      />,
    );

    const button = screen.getByRole("button", { name: "クエストを開始する" });
    fireEvent.click(button);

    expect(handleStart).toHaveBeenCalledTimes(1);
  });

  it("チェックポイントカードをクリックしてタイトルを編集できる", () => {
    render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
      />,
    );

    // カードをクリックして編集モードにする
    const cardTitle = screen.getByText("基本画面が完成している");
    fireEvent.click(cardTitle);

    const input = screen.getByDisplayValue("基本画面が完成している");
    expect(input).toBeInTheDocument();

    // 編集して Enter
    fireEvent.change(input, { target: { value: "UIプロトタイプが完成している" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("UIプロトタイプが完成している")).toBeInTheDocument();
  });
});
