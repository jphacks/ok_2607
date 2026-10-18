import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import QuestLoading from "./loading";

describe("QuestLoading (App Router Loading Boundary)", () => {
  it("クエスト画面のローディングUIを正常にレンダリングする", () => {
    render(<QuestLoading />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("LOADING")).toBeInTheDocument();
    expect(screen.getByText("クエストの書をひらいている…")).toBeInTheDocument();
    expect(screen.getByLabelText("主人公")).toBeInTheDocument();
  });
});
