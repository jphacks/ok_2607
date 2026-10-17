/**
 * サーバー専用の環境変数。クライアントコンポーネントから import するとビルドエラーになる。
 */
import "server-only";
import { z } from "zod";

const ServerEnv = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
});
export type ServerEnv = z.infer<typeof ServerEnv>;

const SupabaseEnv = ServerEnv.pick({ SUPABASE_URL: true, SUPABASE_SERVICE_ROLE_KEY: true });

export function supabaseEnv(): z.infer<typeof SupabaseEnv> {
  const result = SupabaseEnv.safeParse(process.env);
  if (!result.success) {
    throw new Error("Supabase の環境変数が不足しています（.env.example を参照）");
  }
  return result.data;
}
let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!cached) {
    const result = ServerEnv.safeParse(process.env);
    if (!result.success) {
      const keys = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`環境変数が不足しています: ${keys}（.env.example を参照）`);
    }
    cached = result.data;
  }
  return cached;
}
