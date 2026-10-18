import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PixelButton } from "./PixelButton";

describe("PixelButton", () => {
  it("primary バリアントをレンダリングしクリックできる", () => {
    const handleClick = vi.fn();
    render(<PixelButton onClick={handleClick}>クエスト開始</PixelButton>);

    const button = screen.getByRole("button", { name: "クエスト開始" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("bg-gold", "text-gold-ink");

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("secondary バリアントのスタイルが適用される", () => {
    render(<PixelButton variant="secondary">戻る</PixelButton>);
    const button = screen.getByRole("button", { name: "戻る" });
    expect(button).toHaveClass("bg-panel", "text-gold-text");
  });

  it("disabled 状態のときはクリックされない", () => {
    const handleClick = vi.fn();
    render(
      <PixelButton disabled onClick={handleClick}>
        無効ボタン
      </PixelButton>,
    );
    const button = screen.getByRole("button", { name: "無効ボタン" });
    expect(button).toBeDisabled();
    expect(button).toHaveClass("cursor-not-allowed");

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
