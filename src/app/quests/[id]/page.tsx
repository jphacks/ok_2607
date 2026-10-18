import { notFound, redirect } from "next/navigation";
import { getQuestDetail } from "@/features/checkpoint/service";
import { calculateLevel } from "@/features/checkpoint/xp";
import { QuestProgressScreen } from "@/features/checkpoint/components/QuestProgressScreen";
import { getStats } from "@/features/task/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestPage({ params }: PageProps) {
  const { id } = await params;

  // デモ確認用（Figma 05 画面再現データ: 2/5 完了状態）
  if (id === "demo") {
    return (
      <QuestProgressScreen
        questId="demo"
        taskTitle="Webアプリを完成させる"
        level={4}
        initialCheckpoints={[
          {
            id: "demo-cp-1",
            questId: "demo",
            parentId: null,
            title: "基本画面が完成している",
            description: "到達すべき状態",
            position: 0,
            isDone: true, // Figma ではチェック済み
            doneAt: "2026-10-17T00:00:00Z",
          },
          {
            id: "demo-cp-2",
            questId: "demo",
            parentId: null,
            title: "主要機能が1つ動作する",
            description: "到達すべき状態",
            position: 1,
            isDone: true, // Figma ではチェック済み
            doneAt: "2026-10-17T00:00:00Z",
          },
          {
            id: "demo-cp-3",
            questId: "demo",
            parentId: null,
            title: "データを保存・読み込みできる",
            description: "到達すべき状態",
            position: 2,
            isDone: false,
            doneAt: null,
          },
          {
            id: "demo-cp-4",
            questId: "demo",
            parentId: null,
            title: "第三者が操作できる",
            description: "到達すべき状態",
            position: 3,
            isDone: false,
            doneAt: null,
          },
          {
            id: "demo-cp-5",
            questId: "demo",
            parentId: null,
            title: "公開環境で動作する",
            description: "到達すべき状態",
            position: 4,
            isDone: false,
            doneAt: null,
          },
        ]}
      />
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }
  const supabase = supabaseServer();

  let questDetail = null;
  try {
    questDetail = await getQuestDetail(supabase, id, user.id);
  } catch {
    // クエスト取得エラー時は下流でハンドリング
  }

  if (!questDetail) {
    notFound();
  }

  let totalXp = 0;
  try {
    const stats = await getStats(user.id);
    totalXp = stats?.totalXp ?? 0;
  } catch {
    totalXp = 0;
  }
  const { level } = calculateLevel(totalXp);

  return (
    <QuestProgressScreen
      questId={id}
      taskTitle={questDetail.task.title}
      initialCheckpoints={questDetail.checkpoints}
      level={level}
    />
  );
}
