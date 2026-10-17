import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(),
}));

vi.mock("@/features/checkpoint/service", () => ({
  updateCheckpointStatus: vi.fn(),
}));

import { updateCheckpointStatus } from "@/features/checkpoint/service";

function createJsonRequest(body: string) {
  return new Request("http://localhost:3000/api/checkpoints/test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("PATCH /api/checkpoints/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("チェックポイントが存在しない場合は 404 not_found を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(updateCheckpointStatus).mockResolvedValueOnce(null);

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
    vi.mocked(updateCheckpointStatus).mockResolvedValueOnce(mockCheckpoint);

    const request = createJsonRequest(JSON.stringify({ isDone: true }));
    const response = await PATCH(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ checkpoint: mockCheckpoint });
  });

  it("DB 処理等で例外が発生した場合は 500 internal_error を返す", async () => {
    const validUuid = "11111111-1111-4111-a111-111111111111";
    vi.mocked(updateCheckpointStatus).mockRejectedValueOnce(new Error("DB error"));

    const request = createJsonRequest(JSON.stringify({ isDone: true }));
    const response = await PATCH(request, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });
});
