import { describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "./auth";

vi.mock("@/lib/supabase/server", () => ({
  createAuthServerClient: vi.fn(),
}));

import { createAuthServerClient } from "@/lib/supabase/server";

describe("getCurrentUser", () => {
  it("セッションが存在し有効なユーザーがいる場合、ユーザーオブジェクトを返す", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    vi.mocked(createAuthServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: mockUser },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createAuthServerClient>>);

    const user = await getCurrentUser();
    expect(user).toEqual(mockUser);
  });

  it("未ログイン（error または user が null）の場合、null を返す", async () => {
    vi.mocked(createAuthServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: null },
          error: new Error("No session"),
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createAuthServerClient>>);

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("クライアント生成で例外が発生した場合もクラッシュせず null を返す", async () => {
    vi.mocked(createAuthServerClient).mockRejectedValueOnce(new Error("Missing env"));

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});
