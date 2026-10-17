-- クエスト完了ストアドプロシージャ
-- クエストの状態を 'completed'、タスクの状態を 'done' に原子的（トランザクション）に更新し、
-- 獲得経験値の付与と合計経験値の集計を 1 トランザクションで行う。

create or replace function public.complete_quest(
  p_quest_id uuid,
  p_xp_earned integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_quest record;
  v_total_xp bigint;
begin
  -- 1. 進行中のクエストを更新
  update public.quests
  set
    status = 'completed',
    completed_at = now(),
    xp_earned = p_xp_earned
  where id = p_quest_id and status = 'in_progress'
  returning * into v_quest;

  -- 該当する進行中クエストがなければ null を返却
  if v_quest is null then
    return null;
  end if;

  -- 2. 紐づくタスクを done に更新
  update public.tasks
  set
    status = 'done',
    updated_at = now()
  where id = v_quest.task_id;

  -- 3. 全完了クエストの合計経験値を集計
  select coalesce(sum(xp_earned), 0) into v_total_xp
  from public.quests
  where status = 'completed';

  return jsonb_build_object(
    'quest', to_jsonb(v_quest),
    'total_xp', v_total_xp
  );
end;
$$;
