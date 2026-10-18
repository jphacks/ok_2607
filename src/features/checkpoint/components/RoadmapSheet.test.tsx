import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Checkpoint } from "@/lib/schemas";
import { RoadmapSheet } from "./RoadmapSheet";

function cp(id: string, position: number, isDone: boolean, parentId: string | null = null) {
  return {
    id,
    questId: "quest-1",
    parentId,
    title: id,
    description: null,
    position,
    isDone,
    doneAt: isDone ? "2026-10-18T00:00:00Z" : null,
  } satisfies Checkpoint;
}

const checkpoints = [
  cp("資料を集める", 0, true),
  cp("構成を決める", 1, false),
  cp("本文を書く", 2, false),
  cp("見出しを3つ書く", 0, false, "構成を決める"),
];

describe("RoadmapSheet", () => {
  it("閉じているときは何も表示しない", () => {
    render(<RoadmapSheet open={false} onClose={vi.fn()} taskTitle="レポート" checkpoints={[]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("全マイルストーンを順番に、状態とステップ付きで表示する", () => {
    render(<RoadmapSheet open onClose={vi.fn()} taskTitle="レポート" checkpoints={checkpoints} />);
    const dialog = screen.getByRole("dialog", { name: "ロードマップ" });
    expect(within(dialog).getByText(/1 \/ 3 マイルストーン/)).toBeInTheDocument();

    const items = within(dialog)
      .getAllByRole("listitem")
      .filter((li) => li.dataset.state);
    expect(items.map((li) => li.dataset.state)).toEqual(["done", "current", "locked"]);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[1]).toHaveTextContent("マイルストーン 2: 構成を決める");
    expect(within(items[1]).getByText("・見出しを3つ書く")).toBeInTheDocument();
  });

  it("閉じるボタン・Escape・背景のタップで閉じる", () => {
    const onClose = vi.fn();
    const { container } = render(
      <RoadmapSheet open onClose={onClose} taskTitle="レポート" checkpoints={checkpoints} />,
    );
    const closeButton = screen.getByRole("button", { name: "ロードマップを閉じる" });
    expect(closeButton).toHaveFocus();

    fireEvent.click(closeButton);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(container.querySelector('[aria-hidden="true"]')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
