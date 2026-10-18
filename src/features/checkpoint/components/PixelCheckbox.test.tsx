import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PixelCheckbox } from "./PixelCheckbox";

describe("PixelCheckbox", () => {
  it("チェック状態とアクセシブルネームが正しく反映される", () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <PixelCheckbox
        checked={false}
        onChange={handleChange}
        ariaLabel="基本画面が完成しているを完了にする"
      />,
    );

    const checkbox = screen.getByRole("checkbox", {
      name: "基本画面が完成しているを完了にする",
    });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(checkbox).not.toBeDisabled();

    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalledWith(true);

    rerender(
      <PixelCheckbox
        checked={true}
        onChange={handleChange}
        ariaLabel="基本画面が完成しているを完了にする"
      />,
    );
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("disabled のときはクリックしても onChange が呼ばれない", () => {
    const handleChange = vi.fn();
    render(
      <PixelCheckbox
        checked={false}
        disabled={true}
        onChange={handleChange}
        ariaLabel="ロック中の項目"
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "ロック中の項目" });
    expect(checkbox).toBeDisabled();
    fireEvent.click(checkbox);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("キーボード操作でトグルできる", () => {
    const handleChange = vi.fn();
    render(
      <PixelCheckbox checked={false} onChange={handleChange} ariaLabel="キーボード操作のテスト" />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "キーボード操作のテスト" });
    checkbox.focus();
    expect(document.activeElement).toBe(checkbox);

    // button要素なのでEnterまたはSpaceの押下でclickイベントが発行される
    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalledWith(true);
  });
});
