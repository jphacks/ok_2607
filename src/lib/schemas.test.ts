import { describe, expect, it } from "vitest";
import {
  CreateTaskRequest,
  RecordQuestCandidatesRequest,
  TASK_TITLE_MAX_LENGTH,
  UpdateTaskRequest,
} from "@/lib/schemas";

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

describe("キャッシュから提示した候補の記録", () => {
  const id = "10000000-0000-4000-8000-000000000001";
  it.each([
    [],
    [id, id],
    [id, id.replace(/1$/, "2"), id.replace(/1$/, "3"), id.replace(/1$/, "4")],
    ["不正なID"],
  ])("空・重複・件数超過・不正IDを拒否する: %j", (...ids) => {
    expect(RecordQuestCandidatesRequest.safeParse({ shownTaskIds: ids }).success).toBe(false);
  });
  it("1件から3件の重複しない候補を受け付ける", () => {
    expect(RecordQuestCandidatesRequest.parse({ shownTaskIds: [id] })).toEqual({
      shownTaskIds: [id],
    });
    const ids = [id, id.replace(/1$/, "2"), id.replace(/1$/, "3")];
    expect(RecordQuestCandidatesRequest.parse({ shownTaskIds: ids }).shownTaskIds).toEqual(ids);
  });
});

describe("タスク名の文字数上限", () => {
  it("上限は30文字", () => {
    expect(TASK_TITLE_MAX_LENGTH).toBe(30);
  });

  it.each([CreateTaskRequest, UpdateTaskRequest])("30文字を受け付け31文字を拒否する", (schema) => {
    expect(schema.safeParse({ title: "あ".repeat(30) }).success).toBe(true);
    expect(schema.safeParse({ title: "あ".repeat(31) }).success).toBe(false);
  });

  it("前後の空白を除いて30文字なら受け付ける", () => {
    expect(CreateTaskRequest.parse({ title: ` ${"あ".repeat(30)} ` }).title).toBe("あ".repeat(30));
  });
});
