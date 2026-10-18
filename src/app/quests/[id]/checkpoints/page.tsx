import { notFound, redirect } from "next/navigation";
import { getQuestDetail } from "@/features/checkpoint/service";
import { CheckpointGenerationScreen } from "@/features/checkpoint/components/CheckpointGenerationScreen";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestCheckpointsPage({ params }: PageProps) {
  const { id } = await params;

  // デモ確認用（DB 未起動・モック表示用）
  if (id === "demo") {
    return (
      <CheckpointGenerationScreen
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
            isDone: false,
            doneAt: null,
          },
          {
            id: "demo-cp-2",
            questId: "demo",
            parentId: null,
            title: "主要機能が1つ動作する",
            description: "到達すべき状態",
            position: 1,
            isDone: false,
            doneAt: null,
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

  return (
    <CheckpointGenerationScreen
      questId={id}
      taskTitle={questDetail.task.title}
      initialCheckpoints={questDetail.checkpoints}
    />
  );
}
