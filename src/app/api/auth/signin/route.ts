import { NextResponse } from "next/server";
import { apiError, ok } from "@/lib/api-response";
import { createAuthServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const supabase = await createAuthServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${url.origin}/auth/callback`,
      },
    });

    if (error || !data.url) {
      return NextResponse.redirect(new URL("/?auth_error=auth_failed", url.origin));
    }

    return NextResponse.redirect(data.url, { status: 302 });
  } catch {
    return NextResponse.redirect(new URL("/?auth_error=auth_failed", url.origin));
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  try {
    const supabase = await createAuthServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${url.origin}/auth/callback`,
      },
    });

    if (error || !data.url) {
      return apiError(500, "internal_error", "ログインの開始に失敗しました");
    }

    return ok({ url: data.url });
  } catch {
    return apiError(500, "internal_error", "ログインの開始に失敗しました");
  }
}
