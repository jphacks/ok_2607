import { describe, expect, it } from "vitest";
import { CreateTaskRequest, UpdateTaskRequest } from "@/lib/schemas";

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

describe("タスク登録のreject回数", () => {
  it.each([0, 1, 10, 2147483647])("非負のDB整数を受け付ける: %s", (skippedCount) => {
    expect(CreateTaskRequest.parse({ title: "デモ用タスク", skippedCount })).toEqual({
      title: "デモ用タスク",
      skippedCount,
    });
  });

  it.each([-1, 0.5, 2147483648, null, "3"])("不正なreject回数を拒否する: %j", (skippedCount) => {
    expect(CreateTaskRequest.safeParse({ title: "デモ用タスク", skippedCount }).success).toBe(
      false,
    );
  });
});
