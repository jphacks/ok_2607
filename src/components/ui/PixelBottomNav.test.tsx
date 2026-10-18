import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PixelBottomNav } from "./PixelBottomNav";

describe("PixelBottomNav", () => {
  it("左にタスク、中央にクエスト、右にステータスの3タブが表示される", () => {
    const handleSelect = vi.fn();
    render(<PixelBottomNav currentTab="quest" onSelectTab={handleSelect} />);

    expect(screen.getByRole("navigation", { name: "メインメニュー" })).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);

    // タスク
    const taskBtn = screen.getByRole("button", { name: "タスク" });
    expect(taskBtn).toBeInTheDocument();

    // クエスト（中央、丸ボタン、aria-label付き）
    const questBtn = screen.getByRole("button", { name: "クエスト" });
    expect(questBtn).toBeInTheDocument();
    expect(screen.queryByText("クエストを開始")).not.toBeInTheDocument();
    expect(screen.queryByText("冒険を開始する")).not.toBeInTheDocument();

    // ステータス
    const statusBtn = screen.getByRole("button", { name: "ステータス" });
    expect(statusBtn).toBeInTheDocument();

    // 各タブにSVGアイコンが存在すること
    expect(screen.getByTestId("tasks-icon")).toBeInTheDocument();
    expect(screen.getByTestId("quest-icon")).toBeInTheDocument();
    expect(screen.getByTestId("status-icon")).toBeInTheDocument();
  });
  it("現在のタブに aria-current='page' が設定される", () => {
    const handleSelect = vi.fn();
    const { rerender } = render(<PixelBottomNav currentTab="quest" onSelectTab={handleSelect} />);

    expect(screen.getByRole("button", { name: /クエスト/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "タスク" })).not.toHaveAttribute("aria-current");

    rerender(<PixelBottomNav currentTab="tasks" onSelectTab={handleSelect} />);
    expect(screen.getByRole("button", { name: "タスク" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /クエスト/ })).not.toHaveAttribute("aria-current");
  });

  it("タブをクリックすると onSelectTab が正しく呼ばれる", () => {
    const handleSelect = vi.fn();
    render(<PixelBottomNav currentTab="quest" onSelectTab={handleSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "タスク" }));
    expect(handleSelect).toHaveBeenCalledWith("tasks");

    fireEvent.click(screen.getByRole("button", { name: "ステータス" }));
    expect(handleSelect).toHaveBeenCalledWith("status");

    fireEvent.click(screen.getByRole("button", { name: /クエスト/ }));
    expect(handleSelect).toHaveBeenCalledWith("quest");
  });
});
