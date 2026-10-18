import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Checkpoint } from "@/lib/schemas";
import { CheckpointGenerationScreen } from "./CheckpointGenerationScreen";

// next/navigation のモック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockQuestId = "11111111-1111-4111-a111-111111111111";
const mockCheckpointId1 = "22222222-2222-4222-a222-222222222221";
const mockCheckpointId2 = "22222222-2222-4222-a222-222222222222";
const mockSubCheckpointId = "22222222-2222-4222-a222-222222222223";

const mockCheckpoints: Checkpoint[] = [
  {
    id: mockCheckpointId1,
    questId: mockQuestId,
    parentId: null,
    title: "基本画面が完成している",
    description: "到達すべき状態",
    position: 0,
    isDone: false,
    doneAt: null,
  },
  {
    id: mockCheckpointId2,
    questId: mockQuestId,
    parentId: null,
    title: "主要機能が1つ動作する",
    description: "到達すべき状態",
    position: 1,
    isDone: false,
    doneAt: null,
  },
  {
    id: mockSubCheckpointId,
    questId: mockQuestId,
    parentId: mockCheckpointId1, // 子チェックポイント（全体像一覧には表示されない）
    title: "子タスク1",
    description: null,
    position: 0,
    isDone: false,
    doneAt: null,
  },
];

const generatedCheckpoint: Checkpoint = {
  ...mockCheckpoints[0],
  id: "11111111-1111-4111-8111-111111111111",
  questId: "22222222-2222-4222-8222-222222222222",
};

describe("CheckpointGenerationScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
        questId={mockQuestId}
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
      `/api/checkpoints/${mockCheckpointId1}`,
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "UIプロトタイプが完成している" }),
      }),
    );

    expect(await screen.findByText("UIプロトタイプが完成している")).toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it("並び替えた後に編集・保存しても、並び替えた順序(position)が維持される", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        // API はDB上の古い position: 0 を返してくる想定
        checkpoint: { ...mockCheckpoints[0], title: "更新されたタイトル", position: 0 },
      }),
    } as Response);

    const handleStart = vi.fn();
    render(
      <CheckpointGenerationScreen
        questId={mockQuestId}
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
        onStartQuest={handleStart}
      />,
    );

    // 1つ目の「下へ」を押して順番を入れ替える (cp-2 が先頭、cp-1 が2番目)
    const downButtons = screen.getAllByRole("button", { name: "下へ移動" });
    fireEvent.click(downButtons[0]);

    // 2番目になった cp-1 の編集ボタンを押して編集・保存
    const editButtons = screen.getAllByRole("button", { name: "編集" });
    fireEvent.click(editButtons[1]);

    const input = screen.getByDisplayValue("基本画面が完成している");
    fireEvent.change(input, { target: { value: "更新されたタイトル" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("更新されたタイトル")).toBeInTheDocument();

    // クエスト開始時に、入れ替わった順序(cp-2: position 0, cp-1: position 1)が維持されていること
    fireEvent.click(screen.getByRole("button", { name: "クエストを開始する" }));
    expect(handleStart).toHaveBeenCalledWith([
      expect.objectContaining({ id: mockCheckpointId2, position: 0 }),
      expect.objectContaining({ id: mockCheckpointId1, position: 1, title: "更新されたタイトル" }),
    ]);

    fetchSpy.mockRestore();
  });

  it("編集中は移動ボタンが無効化される", () => {
    render(
      <CheckpointGenerationScreen
        questId={mockQuestId}
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
      />,
    );

    const editButtons = screen.getAllByRole("button", { name: "編集" });
    fireEvent.click(editButtons[0]);

    const upButtons = screen.getAllByRole("button", { name: "上へ移動" });
    const downButtons = screen.getAllByRole("button", { name: "下へ移動" });
    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[0]).toBeDisabled();
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
      json: async () => ({
        error: { code: "INTERNAL_ERROR", message: "ネットワークエラー" },
      }),
    } as Response);

    render(
      <CheckpointGenerationScreen
        questId={mockQuestId}
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
        ...generatedCheckpoint,
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
    expect(screen.getByText("完了した処理: 1 / 2 件")).toBeInTheDocument();

    // fetch 完了後にバナーとチェックポイントが表示される
    expect(await screen.findByTestId("fallback-banner")).toBeInTheDocument();
    expect(screen.getByText("基本のロードマップを作成しました")).toBeInTheDocument();
    expect(screen.getByText("準備と整理")).toBeInTheDocument();
    expect(
      screen.getByText(/基本ステップは自由に追加・編集・並び替えできます/),
    ).toBeInTheDocument();
    expect(screen.getByText("すべての処理が完了しました")).toBeInTheDocument();
    expect(screen.getByText("完了した処理: 2 / 2 件")).toBeInTheDocument();

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
    expect(screen.getByText("エラーがあります")).toBeInTheDocument();
    expect(screen.getByText("完了した処理: 1 / 2 件")).toBeInTheDocument();
    expect(screen.queryByText("すべての処理が完了しました")).not.toBeInTheDocument();

    const startButton = screen.getByRole("button", { name: "クエストを開始する" });
    expect(startButton).toBeDisabled();

    fetchSpy.mockRestore();
  });

  it("レスポンスと本文の取得中は生成・保存を完了にせず、有効な結果の確認後に完了する", async () => {
    let resolveResponse!: (response: Response) => void;
    let resolveJson!: (body: unknown) => void;
    const response = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const body = new Promise<unknown>((resolve) => {
      resolveJson = resolve;
    });
    vi.spyOn(global, "fetch").mockReturnValueOnce(response);

    render(
      <CheckpointGenerationScreen
        questId={generatedCheckpoint.questId}
        taskTitle="Webアプリを完成させる"
      />,
    );

    const startButton = screen.getByRole("button", { name: "クエストを開始する" });
    expect(startButton).toBeDisabled();
    expect(screen.getByText("完了した処理: 1 / 2 件")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "AIによる道筋の生成・保存：処理中" }),
    ).not.toHaveAttribute("aria-valuenow");
    expect(screen.queryByText("すべての処理が完了しました")).not.toBeInTheDocument();

    await act(async () => {
      resolveResponse({ ok: true, json: () => body } as Response);
    });

    expect(startButton).toBeDisabled();
    expect(screen.getByText("完了した処理: 1 / 2 件")).toBeInTheDocument();
    expect(screen.queryByText("すべての処理が完了しました")).not.toBeInTheDocument();

    await act(async () => {
      resolveJson({ checkpoints: [generatedCheckpoint] });
    });

    expect(screen.getByText(generatedCheckpoint.title)).toBeInTheDocument();
    expect(screen.getByText("完了した処理: 2 / 2 件")).toBeInTheDocument();
    expect(screen.getByText("すべての処理が完了しました")).toBeInTheDocument();
    expect(startButton).not.toBeDisabled();
  });

  it("通信が拒否された場合は生成・保存をエラーとし、完了にはしない", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("通信が切断されました"));

    render(
      <CheckpointGenerationScreen
        questId={generatedCheckpoint.questId}
        taskTitle="Webアプリを完成させる"
      />,
    );

    expect(await screen.findByText("通信が切断されました")).toBeInTheDocument();
    expect(screen.getByText("エラーがあります")).toBeInTheDocument();
    expect(screen.getByText("完了した処理: 1 / 2 件")).toBeInTheDocument();
    expect(screen.queryByText("すべての処理が完了しました")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "クエストを開始する" })).toBeDisabled();
  });

  it.each([
    ["nullの本文", null],
    ["チェックポイントがない本文", {}],
    ["空のチェックポイント", { checkpoints: [] }],
    ["スキーマに違反するチェックポイント", { checkpoints: [{ title: "準備" }] }],
    [
      "親のないチェックポイント",
      { checkpoints: [{ ...generatedCheckpoint, parentId: generatedCheckpoint.id }] },
    ],
    ["空白の親タイトル", { checkpoints: [{ ...generatedCheckpoint, title: " \n " }] }],
  ])("HTTP成功でも%sは完了とみなさない", async (_label, body) => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => body,
    } as Response);

    render(
      <CheckpointGenerationScreen
        questId={generatedCheckpoint.questId}
        taskTitle="Webアプリを完成させる"
      />,
    );

    expect(await screen.findByText("チェックポイントの生成結果が不正です")).toBeInTheDocument();
    expect(screen.getByText("エラーがあります")).toBeInTheDocument();
    expect(screen.getByText("完了した処理: 1 / 2 件")).toBeInTheDocument();
    expect(screen.queryByText("すべての処理が完了しました")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "クエストを開始する" })).toBeDisabled();
  });
});

afterEach(() => vi.restoreAllMocks());

const editQuestId = "11111111-1111-4111-a111-111111111111";
const editableCheckpoint: Checkpoint = {
  ...mockCheckpoints[0],
  id: "22222222-2222-4222-a222-222222222222",
  questId: editQuestId,
  isDone: true,
  doneAt: "2026-10-18T00:00:00Z",
};
function renderEditor() {
  render(
    <CheckpointGenerationScreen
      questId={editQuestId}
      taskTitle="編集するタスク"
      initialCheckpoints={[editableCheckpoint]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "編集" }));
  return screen.getByRole("textbox", { name: "チェックポイント名" });
}
function savedResponse(title: string) {
  return new Response(JSON.stringify({ checkpoint: { ...editableCheckpoint, title } }));
}

describe("チェックポイント名の保存", () => {
  it("名前だけを保存し、サーバーの保存成功後に表示へ反映する", async () => {
    let finish!: (response: Response) => void;
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const input = renderEditor();
    fireEvent.change(input, { target: { value: "  保存済みの名前  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/checkpoints/${editableCheckpoint.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "保存済みの名前" }),
      }),
    );
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "クエストを開始する" })).toBeDisabled();
    finish(savedResponse("保存済みの名前"));
    expect(await screen.findByText("保存済みの名前")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "クエストを開始する" })).toBeEnabled();
  });

  it.each(["HTTP失敗", "通信失敗", "不正な成功応答"])(
    "%sで入力を保持して再試行できる",
    async (kind) => {
      const fetchSpy = vi.spyOn(global, "fetch");
      if (kind === "通信失敗") fetchSpy.mockRejectedValueOnce(new TypeError("offline"));
      else
        fetchSpy.mockResolvedValueOnce(
          kind === "HTTP失敗" ? new Response("unavailable", { status: 500 }) : new Response("{}"),
        );
      fetchSpy.mockResolvedValueOnce(savedResponse("再試行する名前"));
      const input = renderEditor();
      fireEvent.change(input, { target: { value: "再試行する名前" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(await screen.findByRole("alert")).toBeVisible();
      expect(input).toHaveValue("再試行する名前");
      expect(input).toBeEnabled();
      expect(screen.getByRole("button", { name: "クエストを開始する" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "もう一度保存する" }));
      expect(await screen.findByText("再試行する名前")).toBeVisible();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    },
  );

  it("空白だけの名前は保存せず、Escapeとその後のblurで変更しない", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const input = renderEditor();
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent("1〜200文字");
    fireEvent.change(input, { target: { value: "取り消す名前" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(screen.getByText(editableCheckpoint.title)).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ヘッダーに指定した level が表示され、省略時はデフォルト Lv. 1 が表示される", () => {
    const { unmount } = render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
        level={3}
      />,
    );
    expect(screen.getByText(/LV\.\s*03/)).toBeInTheDocument();
    unmount();

    render(
      <CheckpointGenerationScreen
        questId="quest-1"
        taskTitle="Webアプリを完成させる"
        initialCheckpoints={mockCheckpoints}
      />,
    );
    expect(screen.getByText(/LV\.\s*01/)).toBeInTheDocument();
  });
});

it("IME変換確定のEnterでは保存しない", () => {
  const spy = vi.spyOn(global, "fetch");
  const input = renderEditor();
  fireEvent.change(input, { target: { value: "変換確定した名前" } });
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(spy).not.toHaveBeenCalled();
  expect(input).toHaveValue("変換確定した名前");
  expect(input).toBeInTheDocument();
});
