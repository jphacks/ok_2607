import { describe, expect, it } from "vitest";
import { UpdateCheckpointFieldsRequest, UpdateCheckpointRequest } from "@/lib/schemas";

describe("チェックポイント編集の先行契約", () => {
  it.each([{ title: "  名前  " }, { isDone: false }, { title: "名前", isDone: true }])(
    "必要な項目だけ更新できる: %j",
    (input) => {
      const parsed = UpdateCheckpointFieldsRequest.parse(input);
      expect(parsed).toEqual({ ...input, ...(input.title !== undefined ? { title: "名前" } : {}) });
    },
  );
  it.each([
    {},
    { title: "" },
    { title: "  " },
    { title: "あ".repeat(201) },
    { title: null },
    { isDone: "true" },
    { unknown: true },
    { title: "名前", unknown: true },
  ])("不正な更新を拒否する: %j", (input) => {
    expect(UpdateCheckpointFieldsRequest.safeParse(input).success).toBe(false);
  });
  it("現行Route Handler用の契約を維持する", () => {
    expect(UpdateCheckpointRequest.parse({ isDone: true })).toEqual({ isDone: true });
    expect(UpdateCheckpointRequest.safeParse({ title: "名前" }).success).toBe(false);
  });
});
