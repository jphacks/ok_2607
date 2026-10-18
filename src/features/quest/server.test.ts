import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/lib/schemas";
import type * as TaskServer from "@/features/task/server";
import { getQuestCandidates, questFromRow, startQuest } from "@/features/quest/server";
import { POST } from "@/app/api/quests/route";
import { GET } from "@/app/api/quests/candidates/route";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  listTasks: vi.fn(),
  questLookup: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.questLookup }),
      }),
    }),
  }),
}));
vi.mock("@/features/task/server", async (importOriginal) => {
  const original = await importOriginal<typeof TaskServer>();
  return { ...original, listTasks: mocks.listTasks };
});

const firstId = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";
const questId = "00000000-0000-4000-8000-000000000003";
const now = new Date("2026-10-17T12:00:00.000Z");
const firstTask: Task = {
  id: firstId,
  title: "本を読む",
  dueAt: null,
  status: "active",
  shownCount: 0,
  skippedCount: 0,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};
const questRow = {
  id: questId,
  task_id: firstId,
  status: "in_progress",
  is_urgent: false,
  xp_earned: 0,
  started_at: now.toISOString(),
  completed_at: null,
};

function request(body: unknown) {
  return new Request("http://localhost/api/quests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.questLookup.mockResolvedValue({ data: null, error: null });
});

describe("クエスト候補の保存と応答", () => {
  it("進行中なら既存クエストを返し、候補の抽選・提示回数更新を行わない", async () => {
    mocks.questLookup.mockResolvedValue({ data: questRow, error: null });
    mocks.listTasks.mockResolvedValue([firstTask]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      isUrgent: false,
      candidates: [],
      inProgressQuest: { id: questId, taskId: firstId, status: "in_progress" },
    });
    expect(mocks.listTasks).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("進行状態の取得に失敗した場合も候補を提示せず500を返す", async () => {
    mocks.questLookup.mockResolvedValue({ data: null, error: { code: "XX000" } });
    mocks.listTasks.mockResolvedValue([firstTask]);

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "internal_error" } });
    expect(mocks.listTasks).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("0件ならDB更新をせず正常な空の候補を返す", async () => {
    mocks.listTasks.mockResolvedValue([]);
    expect(await getQuestCandidates({ now })).toEqual({
      isUrgent: false,
      candidates: [],
      inProgressQuest: null,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("抽選後に状態が変わった場合は409を返す", async () => {
    mocks.listTasks.mockResolvedValue([firstTask]);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001" } });
    const response = await GET();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "conflict" } });
  });

  it("DB障害では架空の候補に置き換えず500を返す", async () => {
    mocks.listTasks.mockRejectedValue(new Error("接続できません"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "internal_error" } });
  });
});

describe("クエスト開始の入力と状態", () => {
  it("提示されていないタスクを選べずDBを変更しない", async () => {
    const response = await POST(request({ selectedTaskId: firstId, shownTaskIds: [secondId] }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "validation_error" } });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("提示IDの重複によるreject回数の二重更新を拒否する", async () => {
    const response = await POST(
      request({ selectedTaskId: firstId, shownTaskIds: [firstId, firstId] }),
    );
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("提示IDが空の場合とUUIDでない場合を拒否する", async () => {
    const empty = await POST(request({ selectedTaskId: firstId, shownTaskIds: [] }));
    const invalid = await POST(request({ selectedTaskId: "不正", shownTaskIds: [firstId] }));
    expect(empty.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("壊れたJSONをinvalid_jsonとして拒否する", async () => {
    const response = await POST(
      new Request("http://localhost/api/quests", { method: "POST", body: "{" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_json" } });
  });

  it("同時開始や非activeな選択をDBが拒否した場合は409を返す", async () => {
    mocks.rpc.mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: null, error: { code: "P0001" } }),
    });
    const response = await POST(request({ selectedTaskId: firstId, shownTaskIds: [firstId] }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "conflict" } });
  });

  it("不正なDB行を成功したクエストとして返さない", async () => {
    expect(() => questFromRow({ ...questRow, status: "不正" })).toThrow();
    mocks.rpc.mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { ...questRow, task_id: "不正" }, error: null }),
    });
    await expect(
      startQuest({ selectedTaskId: firstId, shownTaskIds: [firstId] }),
    ).rejects.toThrow();
  });
});
