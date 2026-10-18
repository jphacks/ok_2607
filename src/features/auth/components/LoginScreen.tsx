"use client";

import { useState } from "react";
import { HeroPixelArt } from "@/features/checkpoint/components/HeroPixelArt";
import { createClient } from "@/lib/supabase/client";

export function LoginScreen() {
  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignIn = async () => {
    setSigningIn(true);
    setErrorMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErrorMessage("ログインの開始に失敗しました。もう一度お試しください。");
        setSigningIn(false);
      }
    } catch {
      setErrorMessage("通信エラーが発生しました。接続を確認してください。");
      setSigningIn(false);
    }
  };

  return (
    <div className="rogue-shell relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-between bg-surface p-6 text-text shadow-2xl sm:px-8 sm:py-8 lg:px-12 lg:py-10">
      {/* 上部タイトル */}
      <header className="pt-8 text-center">
        <span className="font-mono text-xs text-gold-accent" aria-hidden="true">
          ✦ 3択タスク管理 ✦
        </span>
        <h1 className="mt-2 font-mono text-3xl font-bold tracking-wider text-gold">TriOne</h1>
        <p className="mt-2 text-xs text-muted">やらないことを決める、大人のためのタスク管理</p>
      </header>

      {/* 中央キャラクター & 説明パネル */}
      <main className="my-auto flex flex-col items-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-lg border-2 border-line bg-panel p-2 shadow-inner">
          <HeroPixelArt size={64} />
        </div>

        <div className="pixel-panel w-full p-5 text-center">
          <h2 className="text-sm font-bold text-text">冒険の書を開く</h2>
          <p className="mt-3 text-xs leading-5 text-muted">
            3択から 1 つ選ぶだけで「やること」が決まり、
            <br />
            選ばなかったものは自然と手放せる。
            <br />
            AI がタスクを小さな一歩に分解します。
          </p>
        </div>

        {errorMessage && (
          <p role="alert" className="mt-4 text-xs text-danger">
            {errorMessage}
          </p>
        )}
      </main>

      {/* 下部アクション */}
      <footer className="pb-8">
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="gold-button flex w-full items-center justify-center gap-2 py-4 text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <span aria-hidden="true">⚔</span>
          <span>{signingIn ? "連携画面を開いています…" : "Google アカウントで冒険を始める"}</span>
        </button>
        <p className="mt-4 text-center text-[10px] text-muted">
          Google アカウントを使って安全にサインインします。
        </p>
      </footer>
    </div>
  );
}
