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
    expect(screen.getByText("✦ TriOne")).toBeInTheDocument();
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
    expect(
      screen.getByText(/AIが提案したチェックポイントは自由に追加・編集・並び替えできます/),
    ).toBeInTheDocument();
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
    expect(handleStart).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: "基本画面が完成している" }),
        expect.objectContaining({ title: "主要機能が1つ動作する" }),
      ]),
    );
  });

  it("「▲」または「▼」ボタンを押すとステップの順番が入れ替わり、ステップ番号が正しく更新され、クエスト開始時にも反映される", () => {
    const handleStart = vi.fn();
    render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
        onStartQuest={handleStart}
      />,
    );

    const downButtons = screen.getAllByRole("button", { name: "下へ移動" });
    const upButtons = screen.getAllByRole("button", { name: "上へ移動" });

    // 先頭の「上へ」と末尾の「下へ」は disabled
    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[1]).toBeDisabled();

    // 1 つ目の「下へ」を押す
    fireEvent.click(downButtons[0]);

    // 順序が入れ替わっていることを確認
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]).toHaveTextContent("主要機能が1つ動作する");
    expect(headings[1]).toHaveTextContent("基本画面が完成している");

    // クエスト開始ボタンを押すと、入れ替わった順序で渡されること
    const startButton = screen.getByRole("button", { name: "クエストを開始する" });
    fireEvent.click(startButton);

    expect(handleStart).toHaveBeenCalledWith([
      expect.objectContaining({ title: "主要機能が1つ動作する", position: 0 }),
      expect.objectContaining({ title: "基本画面が完成している", position: 1 }),
    ]);
  });

  it("「編集」ボタンを押すと編集状態になり、タイトルを変更して「保存」を押すと画面とDBに反映される", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkpoint: { ...mockCheckpoints[0], title: "UIプロトタイプが完成している" },
      }),
    } as Response);

    render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
      />,
    );

    const editButtons = screen.getAllByRole("button", { name: "編集" });
    fireEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue("基本画面が完成している");
    expect(input).toBeInTheDocument();

    // 編集して「保存」ボタンをクリック
    fireEvent.change(input, { target: { value: "UIプロトタイプが完成している" } });
    const saveButton = screen.getByRole("button", { name: "保存" });
    fireEvent.click(saveButton);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/checkpoints/cp-1",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "UIプロトタイプが完成している" }),
      }),
    );

    expect(await screen.findByText("UIプロトタイプが完成している")).toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it("チェックポイント編集中に「キャンセル」ボタンまたは Esc キーを押すと編集前の状態に戻る", () => {
    render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
      />,
    );

    const editButtons = screen.getAllByRole("button", { name: "編集" });
    fireEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue("基本画面が完成している");
    fireEvent.change(input, { target: { value: "途中の変更" } });

    // キャンセルボタンを押す
    const cancelButton = screen.getByRole("button", { name: "キャンセル" });
    fireEvent.click(cancelButton);

    expect(screen.queryByDisplayValue("途中の変更")).not.toBeInTheDocument();
    expect(screen.getByText("基本画面が完成している")).toBeInTheDocument();

    // Esc キーでもキャンセルできることを確認
    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);
    const input2 = screen.getByDisplayValue("基本画面が完成している");
    fireEvent.change(input2, { target: { value: "別の変更" } });
    fireEvent.keyDown(input2, { key: "Escape" });

    expect(screen.queryByDisplayValue("別の変更")).not.toBeInTheDocument();
    expect(screen.getByText("基本画面が完成している")).toBeInTheDocument();
  });

  it("編集保存に失敗した場合はエラーを表示し、入力内容を保持する", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "ネットワークエラー" } }),
    } as Response);

    render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
      />,
    );

    const editButtons = screen.getAllByRole("button", { name: "編集" });
    fireEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue("基本画面が完成している");
    fireEvent.change(input, { target: { value: "新しい名前" } });
    const saveButton = screen.getByRole("button", { name: "保存" });
    fireEvent.click(saveButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("ネットワークエラー");
    expect(screen.getByDisplayValue("新しい名前")).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("「＋ チェックポイントを追加」ボタンを押し、タイトルを入力して確定すると末尾に追加され、クエスト開始時にも反映される", () => {
    const handleStart = vi.fn();
    render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
        onStartQuest={handleStart}
      />,
    );

    // 最初は 2 件
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.queryByText("03")).not.toBeInTheDocument();

    // 追加ボタンを押す
    const addBtn = screen.getByRole("button", { name: /チェックポイントを追加/ });
    fireEvent.click(addBtn);

    const input = screen.getByPlaceholderText("例: 参考資料を1本選ぶ");
    fireEvent.change(input, { target: { value: "新しいステップ3" } });

    const confirmBtn = screen.getByRole("button", { name: "追加" });
    fireEvent.click(confirmBtn);

    // 一覧の末尾に 03 として追加されている
    expect(screen.getByText("03")).toBeInTheDocument();
    expect(screen.getByText("新しいステップ3")).toBeInTheDocument();

    // クエスト開始時にも反映される
    const startButton = screen.getByRole("button", { name: "クエストを開始する" });
    fireEvent.click(startButton);

    expect(handleStart).toHaveBeenCalledWith([
      expect.objectContaining({ title: "基本画面が完成している" }),
      expect.objectContaining({ title: "主要機能が1つ動作する" }),
      expect.objectContaining({ title: "新しいステップ3" }),
    ]);
  });

  it("新規追加したチェックポイントを編集・保存できる（DBへのリクエストを行わずローカル更新）", () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
      />,
    );

    // 追加
    const addBtn = screen.getByRole("button", { name: /チェックポイントを追加/ });
    fireEvent.click(addBtn);
    const addInput = screen.getByPlaceholderText("例: 参考資料を1本選ぶ");
    fireEvent.change(addInput, { target: { value: "初期タイトル" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(screen.getByText("初期タイトル")).toBeInTheDocument();

    // 追加したアイテムの「編集」ボタンをクリック（3つ目）
    const editButtons = screen.getAllByRole("button", { name: "編集" });
    fireEvent.click(editButtons[2]);

    const editInput = screen.getByDisplayValue("初期タイトル");
    fireEvent.change(editInput, { target: { value: "修正後タイトル" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    // DBへの fetch は呼ばれず、画面上に反映されること
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText("修正後タイトル")).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("自動生成時に isFallback: true が返された場合、基本ステップ作成の案内バナーが表示される", async () => {
    const mockFallbackCheckpoints = [
      {
        id: "cp-fb-1",
        questId: "quest-1",
        parentId: null,
        title: "準備と整理",
        description: "作業環境や必要な情報を整える",
        position: 0,
        isDone: false,
        doneAt: null,
      },
    ];

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        checkpoints: mockFallbackCheckpoints,
        isFallback: true,
      }),
    } as Response);

    render(<CheckpointGenerationScreen questId="quest-1" taskTitle="Webアプリを完成させる" />);

    // 最初はローディング表示
    expect(screen.getByText("魔道士がクエストを分解中...")).toBeInTheDocument();

    // fetch 完了後にバナーとチェックポイントが表示される
    expect(await screen.findByTestId("fallback-banner")).toBeInTheDocument();
    expect(screen.getByText("基本ステップを作成しました")).toBeInTheDocument();
    expect(screen.getByText("準備と整理")).toBeInTheDocument();
    expect(
      screen.getByText(/基本ステップは自由に追加・編集・並び替えできます/),
    ).toBeInTheDocument();

    // クエスト開始ボタンが押せること
    const startButton = screen.getByRole("button", { name: "クエストを開始する" });
    expect(startButton).not.toBeDisabled();

    fetchSpy.mockRestore();
  });

  it("自動生成でエラーが発生した場合、エラーメッセージと再試行ボタンが表示されクエスト開始は無効", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { code: "internal_error", message: "DB障害が発生しました" },
      }),
    } as Response);

    render(<CheckpointGenerationScreen questId="quest-1" taskTitle="Webアプリを完成させる" />);

    expect(await screen.findByText("生成に失敗しました")).toBeInTheDocument();
    expect(screen.getByText("DB障害が発生しました")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再試行する" })).toBeInTheDocument();

    const startButton = screen.getByRole("button", { name: "クエストを開始する" });
    expect(startButton).toBeDisabled();

    fetchSpy.mockRestore();
  });
});
