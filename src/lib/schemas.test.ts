import { describe, expect, it } from "vitest";
import { UpdateTaskRequest } from "@/lib/schemas";

describe("タスク更新の入力", () => {
  it.each([{}, { unknown: "値" }, { title: undefined }])(
    "更新項目のない入力を拒否する: %j",
    (input) => {
      expect(UpdateTaskRequest.safeParse(input).success).toBe(false);
    },
  );

  it("期限だけの解除とタスク名の更新を受け付ける", () => {
    expect(UpdateTaskRequest.parse({ dueAt: null })).toEqual({ dueAt: null });
    expect(UpdateTaskRequest.parse({ title: "  更新したタスク  " })).toEqual({
      title: "更新したタスク",
    });
  });
});
