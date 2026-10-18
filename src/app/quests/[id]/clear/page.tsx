import { notFound, redirect } from "next/navigation";
import { getQuestDetail } from "@/features/checkpoint/service";
import { calculateLevel } from "@/features/checkpoint/xp";
import { QuestClearScreen } from "@/features/checkpoint/components/QuestClearScreen";
import { getStats } from "@/features/task/server";
import { getCurrentUser } from "@/lib/auth";
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
    totalXp = stats.totalXp;
  } catch {
    totalXp = questDetail.quest.xpEarned ?? 0;
  }

  const parentCheckpoints = questDetail.checkpoints.filter((cp) => cp.parentId === null);
  const completedCount = parentCheckpoints.filter((cp) => cp.isDone).length;
  const totalCount = parentCheckpoints.length;
  const xpGained = questDetail.quest.xpEarned ?? 0;

  // クエスト完了前の累積XPと完了後の累積XPを比較してレベルアップ判定
  const prevTotalXp = Math.max(0, totalXp - xpGained);
  const prevLevelInfo = calculateLevel(prevTotalXp);
  const currentLevelInfo = calculateLevel(totalXp);
  const isLevelUp = currentLevelInfo.level > prevLevelInfo.level;

  return (
    <QuestClearScreen
      questId={id}
      taskTitle={questDetail.task.title}
      completedCheckpointsCount={completedCount}
      totalCheckpointsCount={totalCount > 0 ? totalCount : 5}
      xpGained={xpGained}
      nextLevelXp={currentLevelInfo.nextLevelXp}
      level={currentLevelInfo.level}
      isLevelUp={isLevelUp}
    />
  );
}
