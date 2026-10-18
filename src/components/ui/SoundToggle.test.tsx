import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { isSoundEnabled } from "./sound";
import { SoundToggle } from "./SoundToggle";

beforeEach(() => {
  localStorage.clear();
});

describe("SoundToggle", () => {
  it("押すと効果音がオフになり、もう一度押すとオンに戻る", () => {
    render(<SoundToggle />);
    const button = screen.getByRole("button", { name: "効果音" });
    expect(button).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(isSoundEnabled()).toBe(false);

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(isSoundEnabled()).toBe(true);
  });
});
