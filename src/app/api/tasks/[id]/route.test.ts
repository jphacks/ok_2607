import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/app/api/tasks/[id]/route";

const { databaseFetch } = vi.hoisted(() => ({ databaseFetch: vi.fn<typeof fetch>() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () =>
    createClient("https://database.example", "test-service-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: databaseFetch },
    }),
}));

const id = "a1111111-1111-4111-8111-111111111111";
const missingId = "b1111111-1111-4111-8111-111111111111";
const dueAt = "2026-11-01T09:00:00+00:00";
const original = {
  id,
  title: "本を読む",
  due_at: dueAt,
  weight: 2,
  status: "active",
  shown_count: 3,
  skipped_count: 1,
  created_at: "2026-10-17T09:00:00+00:00",
  updated_at: "2026-10-17T09:00:00+00:00",
};
let rows: Map<string, Record<string, unknown>>;

function context(taskId = id) {
  return { params: Promise.resolve({ id: taskId }) };
}

function patch(body: unknown, taskId = id) {
  return PATCH(
    new Request(`http://localhost/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    context(taskId),
  );
}

function remove(taskId = id) {
  return DELETE(
    new Request(`http://localhost/api/tasks/${taskId}`, { method: "DELETE" }),
    context(taskId),
  );
}

beforeEach(() => {
  rows = new Map([[id, { ...original }]]);
  databaseFetch.mockReset();
  // HTTP 境界だけを置き換え、実際のクライアント・永続化処理・入力検証を通す。
  databaseFetch.mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const taskId = new URL(request.url).searchParams.get("id")?.replace(/^eq\./, "");
    const row = taskId ? rows.get(taskId) : undefined;
    if (!taskId || !row) return Response.json(null);
    if (request.method === "PATCH") {
      const changes: Record<string, unknown> = await request.json();
      const updated = { ...row, ...changes, updated_at: "2026-10-17T10:00:00+00:00" };
      rows.set(taskId, updated);
      return Response.json(updated);
    }
    if (request.method === "DELETE") {
      rows.delete(taskId);
      return Response.json({ id: taskId });
    }
    throw new Error("想定外の DB 操作です");
  });
});

describe("タスク編集・削除の永続化", () => {
  it("タイトルだけの編集では期限・状態・集計を維持する", async () => {
    const response = await patch({ title: "  読書を続ける  " });
    expect(response.status).toBe(200);
    expect(rows.get(id)).toMatchObject({
      title: "読書を続ける",
      due_at: dueAt,
      status: "active",
      weight: 2,
      shown_count: 3,
      skipped_count: 1,
    });
  });

  it("期限の変更・明示的な解除と状態変更を保存し、削除後は編集できない", async () => {
    const nextDueAt = "2026-12-01T09:00:00+00:00";
    expect((await patch({ dueAt: nextDueAt, status: "done" })).status).toBe(200);
    expect(rows.get(id)).toMatchObject({ due_at: nextDueAt, status: "done" });
    expect((await patch({ dueAt: null, status: "active" })).status).toBe(200);
    expect(rows.get(id)).toMatchObject({ due_at: null, status: "active" });
    const response = await remove();
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(rows.has(id)).toBe(false);
    expect((await patch({ title: "再編集" })).status).toBe(404);
    expect((await remove()).status).toBe(404);
  });

  it("存在しないタスクの編集・削除は404", async () => {
    for (const response of [await patch({ title: "変更" }, missingId), await remove(missingId)]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: "not_found", message: "タスクが見つかりません" },
      });
    }
    expect(rows.get(id)).toEqual(original);
  });
});

describe("タスク変更の入力検証", () => {
  it("不正な UUID は編集・削除とも DB に渡さない", async () => {
    for (const response of [await patch({ title: "変更" }, "invalid"), await remove("invalid")]) {
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "validation_error" } });
    }
    expect(databaseFetch).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { unknown: true },
    { title: " " },
    { title: "a".repeat(201) },
    { dueAt: "明日" },
    { status: "unknown" },
    null,
    [],
  ])("不正な更新内容は保存しない: %j", async (body) => {
    const response = await patch(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "validation_error" } });
    expect(databaseFetch).not.toHaveBeenCalled();
    expect(rows.get(id)).toEqual(original);
  });

  it("壊れた JSON は400", async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/tasks/${id}`, {
        method: "PATCH",
        body: "{",
      }),
      context(),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_json" } });
    expect(databaseFetch).not.toHaveBeenCalled();
  });
});

describe("タスク変更のエラー境界", () => {
  it.each(["編集", "削除"])("DB 障害時の%sは詳細を漏らさず500", async (operation) => {
    databaseFetch.mockResolvedValue(
      Response.json({ message: "secret-database-detail", code: "XX000" }, { status: 500 }),
    );
    const response = operation === "編集" ? await patch({ title: "変更" }) : await remove();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "internal_error",
        message:
          operation === "編集" ? "タスクを更新できませんでした" : "タスクを削除できませんでした",
      },
    });
    expect(rows.get(id)).toEqual(original);
  });

  it.each(["編集", "削除"])("DB の不正な行を%sの成功として返さない", async (operation) => {
    databaseFetch.mockResolvedValue(Response.json({ id: "invalid" }));
    const response = operation === "編集" ? await patch({ title: "変更" }) : await remove();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "internal_error" } });
  });
});
