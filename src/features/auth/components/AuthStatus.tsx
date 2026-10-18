"use client";

import { useEffect, useState } from "react";

interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string | null;
}

export function AuthStatus() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { user: UserProfile | null };
          setUser(data.user);
        }
      } catch {
        // ネットワークエラー時は未ログイン扱い
      } finally {
        setLoading(false);
      }
    }
    void loadUser();
  }, []);

  const handleSignIn = () => {
    setSigningIn(true);
    window.location.href = "/api/auth/signin";
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-end px-4 py-2 text-xs text-muted">
        <span>読み込み中…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-line-dim bg-panel px-4 py-2 text-xs text-muted">
      {user ? (
        <>
          <div className="flex items-center gap-2 truncate">
            <span className="text-gold-accent" aria-hidden="true">
              👤
            </span>
            <span className="truncate font-mono">{user.name || user.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="hover:text-gold-text ml-2 shrink-0 underline transition-colors"
          >
            ログアウト
          </button>
        </>
      ) : (
        <>
          <span>ログインしていません</span>
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="border-gold-border text-gold-accent hover:bg-gold-hover hover:text-gold-ink ml-2 shrink-0 rounded border px-2 py-1 font-bold transition-colors disabled:opacity-50"
          >
            {signingIn ? "連携中…" : "Googleでログイン"}
          </button>
        </>
      )}
    </div>
  );
}
