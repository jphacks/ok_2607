import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingText } from "./FloatingText";

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("FloatingText", () => {
  it("文字を表示し、アニメーションが終わったら onDone を 1 回呼ぶ", () => {
    mockReducedMotion(false);
    const onDone = vi.fn();
    render(<FloatingText text="+10 XP" onDone={onDone} />);

    const text = screen.getByText("+10 XP");
    expect(text).toHaveAttribute("aria-hidden", "true");
    expect(text.className).toContain("animate-float-up");

    fireEvent.animationEnd(text);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("動きの低減を指定していると、動かさずに 500ms 後に onDone を呼ぶ", () => {
    vi.useFakeTimers();
    mockReducedMotion(true);
    const onDone = vi.fn();
    render(<FloatingText text="+10 XP" onDone={onDone} />);

    expect(screen.getByText("+10 XP").className).not.toContain("animate-float-up");
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
