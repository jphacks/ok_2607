import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      console.error("Supabase Auth keys missing in callback");
      return NextResponse.redirect(`${origin}/?auth_error=missing_keys`);
    }

    // リダイレクトレスポンスを作成し、そこに直接 Cookie を書き込む
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    console.error("exchangeCodeForSession error:", error);
  }

  // 認証エラー時はトップへリダイレクト
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
