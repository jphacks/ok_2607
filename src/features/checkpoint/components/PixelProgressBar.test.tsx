import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PixelProgressBar } from "./PixelProgressBar";

describe("PixelProgressBar", () => {
  it("進捗件数とパーセンテージを正しく表示する", () => {
    render(<PixelProgressBar completed={2} total={4} />);

    expect(screen.getByText(/進捗/)).toHaveTextContent("進捗 2 / 4");
    expect(screen.getByText("50%")).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "2");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "4");
    expect(progressbar).toHaveClass("bg-field");
  });

  it("total が 0 のときは 0% と表示する", () => {
    render(<PixelProgressBar completed={0} total={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
