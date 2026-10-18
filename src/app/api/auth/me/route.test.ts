import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth";

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未ログイン時は user: null を返す", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ user: null });
  });

  it("ログイン時はユーザープロファイル（id, email, name, avatarUrl）を返す", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      id: "u-1",
      email: "hero@example.com",
      user_metadata: {
        full_name: "ゆうしゃ",
        avatar_url: "https://example.com/avatar.png",
      },
    } as unknown as Awaited<ReturnType<typeof getCurrentUser>>);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      user: {
        id: "u-1",
        email: "hero@example.com",
        name: "ゆうしゃ",
        avatarUrl: "https://example.com/avatar.png",
      },
    });
  });
});
