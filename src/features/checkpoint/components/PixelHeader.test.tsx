import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PixelHeader, DecorativeTileBar } from "./PixelHeader";

describe("PixelHeader", () => {
  it("タイトルとレベルを正しく表示する", () => {
    render(<PixelHeader level={5} />);

    expect(screen.getByText("✦ TriOne")).toBeInTheDocument();
    expect(screen.getByText("LV. 05")).toBeInTheDocument();
  });
});

describe("DecorativeTileBar", () => {
  it("装飾用のドットタイルをレンダリングする", () => {
    const { container } = render(<DecorativeTileBar />);
    const bar = container.firstChild as HTMLElement;
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar.children).toHaveLength(16);
  });
});
