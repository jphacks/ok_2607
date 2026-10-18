import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();

  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/", url.origin), {
    status: 302,
  });
}
