import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/lib/schemas";
import type * as TaskServer from "@/features/task/server";
import { getQuestCandidates, questFromRow, startQuest } from "@/features/quest/server";
import { POST } from "@/app/api/quests/route";
import { GET, POST as recordPresentation } from "@/app/api/quests/candidates/route";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  listTasks: vi.fn(),
  questLookup: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => {
    const builder: {
      select: () => typeof builder;
      eq: () => typeof builder;
      maybeSingle: typeof mocks.questLookup;
    } = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: mocks.questLookup,
    };
    return {
      rpc: mocks.rpc,
      from: () => builder,
    };
  },
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
  mocks.getCurrentUser.mockResolvedValue({ id: "test-user-id", email: "test@example.com" });
  mocks.questLookup.mockResolvedValue({ data: null, error: null });
});

describe("ローカル抽選の提示記録API", () => {
  const savedRow = {
    id: firstId,
    title: firstTask.title,
    due_at: null,
    status: "active",
    shown_count: 1,
    skipped_count: 0,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  it("保存した候補を表示順に返し、抽選用のDB読み取りを繰り返さない", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ ...savedRow, id: secondId }, savedRow],
      error: null,
    });
    const response = await recordPresentation(request({ shownTaskIds: [firstId, secondId] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      tasks: [
        { id: firstId, shownCount: 1 },
        { id: secondId, shownCount: 1 },
      ],
    });
    expect(mocks.listTasks).not.toHaveBeenCalled();
    expect(mocks.questLookup).not.toHaveBeenCalled();
  });

  it.each(["PGRST202", "42883"])(
    "2引数版RPCが未定義（%s）の環境では1引数版RPCへフォールバックして保存する",
    async (code) => {
      mocks.rpc
        .mockResolvedValueOnce({ data: null, error: { code } })
        .mockResolvedValueOnce({ data: [savedRow], error: null });
      const response = await recordPresentation(request({ shownTaskIds: [firstId] }));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        tasks: [{ id: firstId, shownCount: 1 }],
      });
      expect(mocks.rpc).toHaveBeenCalledTimes(2);
      expect(mocks.rpc).toHaveBeenNthCalledWith(1, "record_quest_candidates", {
        p_task_ids: [firstId],
        p_user_id: "test-user-id",
      });
      expect(mocks.rpc).toHaveBeenNthCalledWith(2, "record_quest_candidates", {
        p_task_ids: [firstId],
      });
    },
  );

  it.each([
    { code: "P0001", status: 409, message: "conflict" },
    { code: "XX000", status: 500, message: "internal_error" },
  ])("保存失敗を成功応答にしない: $code", async ({ code, status, message }) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code } });
    const response = await recordPresentation(request({ shownTaskIds: [firstId] }));
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code: message } });
  });

  it.each([[], [savedRow, savedRow], [{ ...savedRow, id: secondId }]])(
    "欠落・重複・別候補の保存結果を完了扱いにしない",
    async (...rows) => {
      mocks.rpc.mockResolvedValue({ data: rows, error: null });
      const response = await recordPresentation(request({ shownTaskIds: [firstId] }));
      expect(response.status).toBe(500);
    },
  );

  it("未認証は保存せず、不正入力と壊れたJSONも拒否する", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);
    expect((await recordPresentation(request({ shownTaskIds: [firstId] }))).status).toBe(401);
    expect((await recordPresentation(request({ shownTaskIds: [firstId, firstId] }))).status).toBe(
      400,
    );
    const invalid = await recordPresentation(
      new Request("http://localhost/api/quests/candidates", { method: "POST", body: "{" }),
    );
    expect(await invalid.json()).toMatchObject({ error: { code: "invalid_json" } });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
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

  it("未ログイン時は 401 unauthorized を返す", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);

    const getRes = await GET();
    expect(getRes.status).toBe(401);
    const getBody = await getRes.json();
    expect(getBody.error.code).toBe("unauthorized");

    mocks.getCurrentUser.mockResolvedValueOnce(null);
    const postRes = await POST(request({ selectedTaskId: firstId, shownTaskIds: [firstId] }));
    expect(postRes.status).toBe(401);
    const postBody = await postRes.json();
    expect(postBody.error.code).toBe("unauthorized");
  });
});
