import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestLoadingScreen } from "./QuestLoadingScreen";

describe("QuestLoadingScreen", () => {
  it("デフォルトのフレーズ、主人公ピクセルアート、LOADINGバッジ、ヘッダーが表示される", () => {
    render(<QuestLoadingScreen />);

    // ヘッダー
    expect(screen.getByText("✦ TriOne")).toBeInTheDocument();
    expect(screen.getByText(/LV\.\s*04/)).toBeInTheDocument();

    // 主人公ピクセルアート
    expect(screen.getByLabelText("主人公")).toBeInTheDocument();

    // LOADING バッジ
    expect(screen.getByText("LOADING")).toBeInTheDocument();

    // デフォルトメッセージ
    expect(screen.getByText("冒険の書をひらいている…")).toBeInTheDocument();
    expect(screen.getByText("ダンジョンへ向かっています…")).toBeInTheDocument();

    // アクセシビリティ属性
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-label", "読み込み中: 冒険の書をひらいている…");
  });

  it("カスタムメッセージとサブメッセージ、レベルを指定して表示できる", () => {
    render(
      <QuestLoadingScreen
        message="チェックポイントを準備中…"
        subMessage="AIの記録を取得しています"
        level={7}
      />,
    );

    expect(screen.getByText("✦ TriOne")).toBeInTheDocument();
    expect(screen.getByText(/LV\.\s*07/)).toBeInTheDocument();
    expect(screen.getByText("チェックポイントを準備中…")).toBeInTheDocument();
    expect(screen.getByText("AIの記録を取得しています")).toBeInTheDocument();

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "読み込み中: チェックポイントを準備中…");
  });

  it("デザインガイドラインに準拠したレイアウトクラス（max-w-3xl）を持つ", () => {
    const { container } = render(<QuestLoadingScreen />);
    const main = container.querySelector("main");
    expect(main).toHaveClass("max-w-3xl");
    expect(main).toHaveClass("font-dotgothic");
  });
});
