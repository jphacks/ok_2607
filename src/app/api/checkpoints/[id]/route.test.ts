import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/features/checkpoint/service", () => ({
  updateCheckpoint: vi.fn(),
}));

import { updateCheckpoint } from "@/features/checkpoint/service";

function createJsonRequest(body: string) {
  return new Request("http://localhost:3000/api/checkpoints/test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("PATCH /api/checkpoints/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "authenticated-user" } as User);
  });

  it("未認証なら入力検証前に 401 を返し DB とサービスを呼ばない", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const response = await PATCH(
      new Request("http://localhost/api?userId=other", { method: "PATCH" }),
      {
        params: Promise.resolve({ id: "invalid" }),
      },
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthorized");
    expect(supabaseServer).not.toHaveBeenCalled();
    expect(updateCheckpoint).not.toHaveBeenCalled();
  });

  it("他ユーザーまたは不存在の対象は同じ 404 とし Cookie のユーザー ID を渡す", async () => {
    vi.mocked(updateCheckpoint).mockResolvedValueOnce(null);
    const request = new Request("http://localhost/api?userId=other", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone: true }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "11111111-1111-4111-a111-111111111111" }),
    });
    expect(response.status).toBe(404);
    expect(updateCheckpoint).toHaveBeenCalledWith(
      undefined,
      "11111111-1111-4111-a111-111111111111",
      { isDone: true },
      "authenticated-user",
    );
  });

  it("無効な UUID の場合は 400 validation_error を返す", async () => {
    const request = createJsonRequest(JSON.stringify({ isDone: true }));
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "invalid-id" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("無効な JSON ボディの場合は 400 invalid_json を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    const request = createJsonRequest("{ broken json");
    const response = await PATCH(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_json");
  });

  it("isDone が boolean でない場合は 400 validation_error を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    const request = createJsonRequest(JSON.stringify({ isDone: "true" }));
    const response = await PATCH(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("タイトルが空文字または空白のみの場合は 400 validation_error を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    const request = createJsonRequest(JSON.stringify({ title: "   " }));
    const response = await PATCH(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("更新項目が空の場合は 400 validation_error を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    const request = createJsonRequest(JSON.stringify({}));
    const response = await PATCH(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("チェックポイントが存在しない場合は 404 not_found を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(updateCheckpoint).mockResolvedValueOnce(null);

    const request = createJsonRequest(JSON.stringify({ isDone: true }));
    const response = await PATCH(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });

  it("正常に更新された場合は 200 と更新後チェックポイントを返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    const mockCheckpoint = {
      id: validUuid,
      questId: "quest-1",
      parentId: null,
      title: "全体像",
      description: null,
      position: 1,
      isDone: true,
      doneAt: "2026-10-17T06:00:00Z",
    };
    vi.mocked(updateCheckpoint).mockResolvedValueOnce(mockCheckpoint);

    const request = createJsonRequest(JSON.stringify({ isDone: true }));
    const response = await PATCH(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ checkpoint: mockCheckpoint });
  });

  it("タイトルのみ正常に更新できる", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    const mockCheckpoint = {
      id: validUuid,
      questId: "quest-1",
      parentId: null,
      title: "参考文献を探す",
      description: null,
      position: 1,
      isDone: false,
      doneAt: null,
    };
    vi.mocked(updateCheckpoint).mockResolvedValueOnce(mockCheckpoint);

    const request = createJsonRequest(JSON.stringify({ title: "  参考文献を探す  " }));
    const response = await PATCH(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ checkpoint: mockCheckpoint });
    expect(updateCheckpoint).toHaveBeenCalledWith(
      undefined,
      validUuid,
      { title: "参考文献を探す" },
      "authenticated-user",
    );
  });

  it("DB 処理等で例外が発生した場合は 500 internal_error を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(updateCheckpoint).mockRejectedValueOnce(new Error("DB error"));

    const request = createJsonRequest(JSON.stringify({ isDone: true }));
    const response = await PATCH(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });
});

describe("チェックポイント名のPATCH契約", () => {
  it("名前の更新はtrimした入力とCookieの本人IDだけをサービスへ渡す", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "owner" } as User);
    vi.mocked(updateCheckpoint).mockResolvedValue(null);
    const response = await PATCH(createJsonRequest(JSON.stringify({ title: "  名前  " })), {
      params: Promise.resolve({ id: "11111111-1111-4111-a111-111111111111" }),
    });
    expect(response.status).toBe(404);
    expect(updateCheckpoint).toHaveBeenLastCalledWith(
      undefined,
      "11111111-1111-4111-a111-111111111111",
      { title: "名前" },
      "owner",
    );
  });
  it.each([{}, { title: " " }, { title: "あ".repeat(201) }, { title: "名前", userId: "other" }])(
    "不正な部分更新を拒否する: %j",
    async (input) => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: "owner" } as User);
      const response = await PATCH(createJsonRequest(JSON.stringify(input)), {
        params: Promise.resolve({ id: "11111111-1111-4111-a111-111111111111" }),
      });
      expect(response.status).toBe(400);
    },
  );
});
