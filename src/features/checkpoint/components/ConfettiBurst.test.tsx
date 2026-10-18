import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfettiBurst } from "./ConfettiBurst";

const stubReducedMotion = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: reduce }));

const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");

describe("ConfettiBurst", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalAnimate) {
      Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
    }
  });

  it("操作を妨げない読み上げ対象外の紙吹雪を、画面からはみ出さない層に描いて動かす", () => {
    stubReducedMotion(false);
    const animate = vi.fn(() => ({ finished: new Promise(() => {}), cancel: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, "animate", {
      value: animate,
      configurable: true,
      writable: true,
    });

    render(<ConfettiBurst />);

    const layer = screen.getByTestId("confetti-burst");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none", "fixed", "inset-0", "overflow-hidden");
    const pieces = layer.querySelectorAll("[data-confetti-id]");
    expect(pieces.length).toBeGreaterThan(0);
    expect(animate).toHaveBeenCalledTimes(pieces.length);
  });

  it("動きを減らす設定のときは演出を出さない", () => {
    stubReducedMotion(true);
    render(<ConfettiBurst />);
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
  });
});
