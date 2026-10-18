import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OperationProgress } from "@/components/ui/OperationProgress";

describe("OperationProgress", () => {
  it("実際に完了した件数と各手順の状態を区別して表示する", () => {
    render(
      <OperationProgress
        title="冒険の準備"
        steps={[
          { label: "タスクを取得", status: "complete" },
          { label: "候補を記録", status: "running" },
          { label: "画面を更新", status: "pending" },
        ]}
      />,
    );

    expect(screen.getByRole("region", { name: "冒険の準備" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "冒険の準備" })).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("処理中");
    expect(status).toHaveTextContent("完了した処理: 1 / 3 件");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByText(/残り時間や時間の進み具合を表すものではありません/)).toBeVisible();

    const count = screen.getByRole("progressbar", { name: "冒険の準備の完了した処理数" });
    expect(count).toHaveAttribute("aria-valuemin", "0");
    expect(count).toHaveAttribute("aria-valuemax", "3");
    expect(count).toHaveAttribute("aria-valuenow", "1");
    expect(count).toHaveAttribute("aria-valuetext", "完了した処理: 1 / 3 件");

    const list = screen.getByRole("list", { name: "冒険の準備の処理手順" });
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("タスクを取得完了");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveTextContent("候補を記録処理中");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).toHaveTextContent("画面を更新待機中");
    expect(items[2]).not.toHaveAttribute("aria-current");

    const running = within(items[1]).getByRole("progressbar", { name: "候補を記録：処理中" });
    expect(running).not.toHaveAttribute("aria-valuenow");
    expect(running).toHaveAttribute("aria-valuetext", "処理中（所要時間は未確定）");
  });

  it("エラーを完了件数に含めず、全件完了と区別する", () => {
    const { rerender } = render(
      <OperationProgress
        title="読み込み"
        steps={[
          { label: "タスクを取得", status: "complete" },
          { label: "候補を記録", status: "error" },
        ]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("エラーがあります");
    expect(screen.getByRole("status")).toHaveTextContent("完了した処理: 1 / 2 件");
    expect(screen.getByText("エラー")).toBeVisible();
    expect(screen.queryByText("すべての処理が完了しました")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "2");

    rerender(
      <OperationProgress
        title="読み込み"
        steps={[
          { label: "タスクを取得", status: "complete" },
          { label: "候補を記録", status: "complete" },
        ]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("すべての処理が完了しました");
    expect(screen.getByRole("status")).toHaveTextContent("完了した処理: 2 / 2 件");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(screen.queryByText("エラー")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("listitem").every((item) => item.textContent?.includes("完了")),
    ).toBe(true);
  });

  it("実行中の処理が失敗しても完了件数を増やさない", () => {
    const { rerender } = render(
      <OperationProgress
        title="AI生成"
        steps={[{ label: "チェックポイントを生成", status: "running" }]}
      />,
    );

    expect(screen.getByRole("progressbar", { name: "AI生成の完了した処理数" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    rerender(
      <OperationProgress
        title="AI生成"
        steps={[{ label: "チェックポイントを生成", status: "error" }]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("エラーがあります");
    expect(screen.getByRole("status")).toHaveTextContent("完了した処理: 0 / 1 件");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("listitem")).not.toHaveAttribute("aria-current");
    expect(
      screen.queryByRole("progressbar", { name: "チェックポイントを生成：処理中" }),
    ).toBeNull();
  });

  it("手順が未設定の場合は完了を宣言しない", () => {
    render(<OperationProgress title="準備" steps={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("待機中");
    expect(screen.getByRole("status")).toHaveTextContent("完了した処理: 0 / 0 件");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("すべての処理が完了しました")).not.toBeInTheDocument();
  });
});
