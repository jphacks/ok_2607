/**
 * サーバー専用の Supabase クライアント。
 * - supabaseServer(): 既存の service_role キーを用いた管理者アクセス（DB操作用）
 * - createAuthServerClient(): リクエストの Cookie からセッション・認証ユーザーを検証するクライアント
 */
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/env";

let serviceClient: SupabaseClient | undefined;

export function supabaseServer(): SupabaseClient {
  if (!serviceClient) {
    const env = supabaseEnv();
    serviceClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export async function createAuthServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase Auth 用の環境変数が不足しています（NEXT_PUBLIC_SUPABASE_ANON_KEY）");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component 内での呼び出しなど、Cookie 更新が許可されないコンテキストを許容
        }
      },
    },
  });
}
