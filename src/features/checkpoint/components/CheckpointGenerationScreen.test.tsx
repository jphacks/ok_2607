import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
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
    expect(screen.getByText(/AIが提案したマイルストーンは編集できます/)).toBeInTheDocument();
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
        questId="demo"
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
    expect(screen.getByText("基本のロードマップを作成しました")).toBeInTheDocument();
    expect(screen.getByText("準備と整理")).toBeInTheDocument();
    expect(
      screen.getByText(/基本のマイルストーンはタップして自由に編集できます/),
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
  fireEvent.click(screen.getByText(editableCheckpoint.title));
  return screen.getByRole("textbox", { name: "マイルストーン名" });
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
