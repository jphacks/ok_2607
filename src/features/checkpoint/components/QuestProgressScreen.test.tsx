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

  describe("順番どおりに 1 つずつ進める", () => {
    const fiveCheckpoints: Checkpoint[] = [
      "資料を集める",
      "構成を決める",
      "本文を書く",
      "見直す",
      "提出する",
    ].map((title, i) => ({
      id: `cp-${i + 1}`,
      questId: "quest-1",
      parentId: null,
      title,
      description: null,
      position: i,
      isDone: i < 2,
      doneAt: i < 2 ? "2026-10-17T00:00:00Z" : null,
    }));

    function renderFive(checkpoints: Checkpoint[] = fiveCheckpoints) {
      render(
        <QuestProgressScreen
          questId="quest-1"
          taskTitle="レポートを書く"
          initialCheckpoints={checkpoints}
        />,
      );
    }

    it("最初の未完了を「今やること」として強調表示する", () => {
      renderFive();
      const group = screen.getByRole("group", { name: "今やること" });
      expect(group).toHaveTextContent("本文を書く");
      expect(group).toHaveTextContent("▶ 今やること");
    });

    it("先の項目はロックされ、クリックしても API を呼ばない", () => {
      renderFive();
      const locked = screen.getByRole("checkbox", { name: /見直す/ });
      expect(locked).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(locked);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(locked).toHaveAttribute("aria-checked", "false");
    });

    it("最後に完了したもの以外の完了済みは外せない", () => {
      renderFive();
      const first = screen.getByRole("checkbox", { name: /資料を集める/ });
      expect(first).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(first);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("最後に完了したものは外せて、今やることがそれに戻る", async () => {
      renderFive();
      const last = screen.getByRole("checkbox", { name: /構成を決める/ });
      expect(last).toHaveAttribute("aria-disabled", "false");
      fireEvent.click(last);

      await waitFor(() => {
        expect(screen.getByRole("group", { name: "今やること" })).toHaveTextContent("構成を決める");
      });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/checkpoints/cp-2",
        expect.objectContaining({ body: JSON.stringify({ isDone: false }) }),
      );
    });

    it("更新に失敗したら元に戻してエラーを表示する", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { code: "internal_error", message: "失敗しました" } }),
      });
      renderFive();
      fireEvent.click(screen.getByText("本文を書く"));

      expect(await screen.findByRole("alert")).toHaveTextContent("失敗しました");
      expect(screen.getByRole("group", { name: "今やること" })).toHaveTextContent("本文を書く");
    });

    it("今やるものの子チェックポイントをカードの中に表示する", () => {
      renderFive([
        ...fiveCheckpoints,
        {
          id: "child-1",
          questId: "quest-1",
          parentId: "cp-3",
          title: "序論を書く",
          description: null,
          position: 0,
          isDone: false,
          doneAt: null,
        },
      ]);
      expect(screen.getByRole("group", { name: "今やること" })).toHaveTextContent("序論を書く");
    });

    it("全部終わると完了メッセージを表示する", () => {
      renderFive(fiveCheckpoints.map((cp) => ({ ...cp, isDone: true })));
      expect(screen.queryByRole("group", { name: "今やること" })).not.toBeInTheDocument();
      expect(screen.getByText("すべてのマイルストーンを達成！")).toBeInTheDocument();
    });

    it("7 件以上あるときは完了済みと先の項目を畳む", () => {
      const many: Checkpoint[] = Array.from({ length: 8 }, (_, i) => ({
        id: `m-${i}`,
        questId: "quest-1",
        parentId: null,
        title: `項目${i}`,
        description: null,
        position: i,
        isDone: i < 3,
        doneAt: null,
      }));
      renderFive(many);

      expect(screen.getByText("✓ 2 件完了")).toBeInTheDocument();
      expect(screen.queryByText("項目0")).not.toBeInTheDocument();
      expect(screen.getByText("項目2")).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "今やること" })).toHaveTextContent("項目3");
      expect(screen.getByText("項目5")).toBeInTheDocument();
      expect(screen.queryByText("項目6")).not.toBeInTheDocument();
      expect(screen.getByText("🔒 ほか 2 件")).toBeInTheDocument();
    });
  });
});

describe("クエスト完了の保存", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderCompleted() {
    return render(
      <QuestProgressScreen
        questId="quest-1"
        taskTitle="保存するタスク"
        initialCheckpoints={mockCheckpoints.map((cp) => ({ ...cp, isDone: true }))}
      />,
    );
  }

  it.each([401, 409, 500])(
    "HTTP %s では進行を保持し再試行で成功したときだけ遷移する",
    async (status) => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ error: { code: "error", message: "保存に失敗しました" } }),
            { status },
          ),
        )
        .mockResolvedValueOnce(new Response("{}"));
      renderCompleted();
      fireEvent.click(screen.getByRole("button", { name: "クエストを完了する" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("保存に失敗しました");
      expect(mockPush).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "クエストを完了する" })).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: "クエストを完了する" }));
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledExactlyOnceWith("/quests/quest-1/clear"),
      );
    },
  );

  it.each(["通信失敗", "JSON以外のエラー応答"])("%s でもクリア画面に進まない", async (kind) => {
    global.fetch =
      kind === "通信失敗"
        ? vi.fn().mockRejectedValue(new TypeError("offline"))
        : vi.fn().mockResolvedValue(new Response("unavailable", { status: 502 }));
    renderCompleted();
    fireEvent.click(screen.getByRole("button", { name: "クエストを完了する" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "クエストを完了する" })).toBeEnabled();
  });

  it("最後のチェックポイント保存中は追加更新と完了を受け付けず、失敗時に戻す", async () => {
    let finish!: (response: Response) => void;
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <QuestProgressScreen
        questId="quest-1"
        taskTitle="保存中"
        initialCheckpoints={mockCheckpoints}
      />,
    );
    fireEvent.click(screen.getByText("データを保存・読み込みできる"));
    expect(screen.getByRole("button", { name: "クエストを完了する" })).toBeDisabled();
    fireEvent.click(screen.getByText("データを保存・読み込みできる"));
    fireEvent.click(screen.getByRole("button", { name: "クエストを完了する" }));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    finish(new Response("{}", { status: 500 }));
    await screen.findByRole("alert");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "クエストを完了する" })).toBeDisabled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("完了保存中の二重送信とチェックポイント更新を防ぐ", async () => {
    let finish!: (response: Response) => void;
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    renderCompleted();
    fireEvent.click(screen.getByRole("button", { name: "クエストを完了する" }));
    fireEvent.click(screen.getByRole("button", { name: "完了処理中..." }));
    fireEvent.click(screen.getByText("データを保存・読み込みできる"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    finish(new Response("{}"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledExactlyOnceWith("/quests/quest-1/clear"));
    expect(screen.getByRole("button", { name: "完了処理中..." })).toBeDisabled();
    fireEvent.click(screen.getByText("データを保存・読み込みできる"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("QuestProgressScreen のロードマップ", () => {
  it("「ロードマップを見る」で全体を開き、閉じると今やること表示に戻る", () => {
    render(
      <QuestProgressScreen
        questId="quest-1"
        taskTitle="アプリ"
        initialCheckpoints={mockCheckpoints}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ロードマップを見る/ }));
    expect(screen.getByRole("dialog", { name: "ロードマップ" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ロードマップを閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "今やること" })).toBeInTheDocument();
  });
});
