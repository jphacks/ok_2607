import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mockSignInWithOAuth = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAuthServerClient: vi.fn(async () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  })),
}));

describe("/api/auth/signin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("OAuth認可URLを取得し302リダイレクトする", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=123" },
        error: null,
      });

      const request = new Request("http://localhost:3000/api/auth/signin");
      const res = await GET(request);

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id=123",
      );
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/auth/callback",
        },
      });
    });

    it("エラー時はトップ画面へリダイレクトする", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { url: null },
        error: new Error("Supabase auth error"),
      });

      const request = new Request("http://localhost:3000/api/auth/signin");
      const res = await GET(request);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/?auth_error=auth_failed");
    });
  });

  describe("POST", () => {
    it("OAuth認可URLをJSONで返す", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=123" },
        error: null,
      });

      const request = new Request("http://localhost:3000/api/auth/signin", { method: "POST" });
      const res = await POST(request);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=123",
      });
    });

    it("エラー時は500エラーJSONを返す", async () => {
      mockSignInWithOAuth.mockResolvedValueOnce({
        data: { url: null },
        error: new Error("Supabase auth error"),
      });

      const request = new Request("http://localhost:3000/api/auth/signin", { method: "POST" });
      const res = await POST(request);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe("internal_error");
    });
  });
});
