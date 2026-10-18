import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PixelCard } from "./PixelCard";

describe("PixelCard", () => {
  it("子要素をレンダリングし、トークンクラスが適用される", () => {
    render(
      <PixelCard>
        <p>カード内容</p>
      </PixelCard>,
    );

    const text = screen.getByText("カード内容");
    expect(text).toBeInTheDocument();
    const container = text.parentElement;
    expect(container).toHaveClass("border-gold-border", "bg-panel");
  });

  it("クリックハンドラが渡された場合にクリック可能になる", () => {
    const handleClick = vi.fn();
    render(
      <PixelCard onClick={handleClick}>
        <p>クリック可能カード</p>
      </PixelCard>,
    );

    const text = screen.getByText("クリック可能カード");
    const container = text.parentElement!;
    expect(container).toHaveClass("cursor-pointer");

    fireEvent.click(container);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
