import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAuthServerClient } from "./supabase/server";

/**
 * 現在のリクエストに含まれる Cookie から認証済みユーザーを取得する。
 * 未ログインまたはセッションが無効な場合は null を返す。
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createAuthServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
