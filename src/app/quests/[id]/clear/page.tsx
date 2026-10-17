import { notFound } from "next/navigation";
import { getQuestDetail } from "@/features/checkpoint/service";
import { QuestClearScreen } from "@/features/checkpoint/components/QuestClearScreen";
import { supabaseServer } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestClearPage({ params }: PageProps) {
  const { id } = await params;

  // デモ確認用（Figma 06 画面再現データ）
  if (id === "demo") {
    return (
      <QuestClearScreen
        questId="demo"
        taskTitle="Webアプリを完成させる"
        completedCheckpointsCount={5}
        totalCheckpointsCount={5}
        xpGained={120}
        nextLevelXp={80}
        level={4}
      />
    );
  }

  const supabase = supabaseServer();

  let questDetail = null;
  try {
    questDetail = await getQuestDetail(supabase, id);
  } catch {
    // クエスト取得エラー時は下流でハンドリング
  }

  if (!questDetail) {
    notFound();
  }

  const parentCheckpoints = questDetail.checkpoints.filter((cp) => cp.parentId === null);
  const completedCount = parentCheckpoints.filter((cp) => cp.isDone).length;
  const totalCount = parentCheckpoints.length;

  return (
    <QuestClearScreen
      questId={id}
      taskTitle={questDetail.task.title}
      completedCheckpointsCount={completedCount || totalCount}
      totalCheckpointsCount={totalCount || 5}
      xpGained={questDetail.quest.xpEarned || 120}
      nextLevelXp={80}
    />
  );
}
