import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DebugActions } from "./debug-actions";

describe("DebugActions", () => {
  it("デバッグ操作のサマリーとアクションボタンが表示される", () => {
    render(
      <DebugActions
        onAddDummyTasks={vi.fn().mockResolvedValue(undefined)}
        onTriggerUrgentQuest={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("🛠 デバッグ操作")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ダミータスクを追加/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /緊急クエストを発動/ })).toBeInTheDocument();
  });

  it("「ダミータスクを追加」をクリックすると onAddDummyTasks が呼ばれ完了メッセージが表示される", async () => {
    const handleAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <DebugActions
        onAddDummyTasks={handleAdd}
        onTriggerUrgentQuest={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const button = screen.getByRole("button", { name: /ダミータスクを追加/ });
    fireEvent.click(button);

    expect(handleAdd).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText("ダミータスクを追加しました")).toBeInTheDocument();
    });
  });

  it("「緊急クエストを発動」をクリックすると onTriggerUrgentQuest が呼ばれ完了メッセージが表示される", async () => {
    const handleUrgent = vi.fn().mockResolvedValue(undefined);
    render(
      <DebugActions
        onAddDummyTasks={vi.fn().mockResolvedValue(undefined)}
        onTriggerUrgentQuest={handleUrgent}
      />,
    );

    const button = screen.getByRole("button", { name: /緊急クエストを発動/ });
    fireEvent.click(button);

    expect(handleUrgent).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText("緊急クエストを発動しました")).toBeInTheDocument();
    });
  });

  it("処理中はボタンが無効化される", async () => {
    let resolveTask: () => void = () => {};
    const pendingPromise = new Promise<void>((resolve) => {
      resolveTask = resolve;
    });
    const handleAdd = vi.fn().mockReturnValue(pendingPromise);

    render(
      <DebugActions
        onAddDummyTasks={handleAdd}
        onTriggerUrgentQuest={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const button = screen.getByRole("button", { name: /ダミータスクを追加/ });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: /緊急クエストを発動/ })).toBeDisabled();

    resolveTask();
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it("エラー発生時にエラーメッセージが表示される", async () => {
    const handleAdd = vi.fn().mockRejectedValue(new Error("登録に失敗しました"));
    render(
      <DebugActions
        onAddDummyTasks={handleAdd}
        onTriggerUrgentQuest={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const button = screen.getByRole("button", { name: /ダミータスクを追加/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("登録に失敗しました")).toBeInTheDocument();
    });
  });
});
