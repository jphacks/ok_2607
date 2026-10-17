-- チェックポイントの原子的置換関数
-- 既存のチェックポイントを削除し、新しいプラン（マイルストーン・ステップ）を一括登録する。
-- 関数全体が 1 つのトランザクションとして実行されるため、途中で失敗した場合はロールバックされ既存データ損失を防ぐ。

create or replace function public.replace_quest_checkpoints(
  p_quest_id uuid,
  p_milestones jsonb
)
returns setof public.checkpoints
language plpgsql
security definer
as $$
declare
  v_milestone jsonb;
  v_step jsonb;
  v_parent_id uuid;
  v_milestone_idx integer := 0;
  v_step_idx integer;
begin
  -- 1. 既存チェックポイントの削除
  delete from public.checkpoints where quest_id = p_quest_id;

  -- 2. マイルストーン（親）とステップ（子）の登録
  for v_milestone in select * from jsonb_array_elements(p_milestones)
  loop
    v_milestone_idx := v_milestone_idx + 1;

    -- 親チェックポイント登録
    insert into public.checkpoints (
      quest_id,
      parent_id,
      title,
      description,
      position,
      is_done
    ) values (
      p_quest_id,
      null,
      v_milestone->>'title',
      v_milestone->>'description',
      v_milestone_idx,
      false
    )
    returning id into v_parent_id;

    -- 子チェックポイント登録
    v_step_idx := 0;
    if jsonb_typeof(v_milestone->'steps') = 'array' then
      for v_step in select * from jsonb_array_elements(v_milestone->'steps')
      loop
        v_step_idx := v_step_idx + 1;

        insert into public.checkpoints (
          quest_id,
          parent_id,
          title,
          description,
          position,
          is_done
        ) values (
          p_quest_id,
          v_parent_id,
          v_step->>'title',
          v_step->>'description',
          v_step_idx,
          false
        );
      end loop;
    end if;
  end loop;

  -- 3. 登録されたチェックポイント一覧を返却
  return query
    select *
    from public.checkpoints
    where quest_id = p_quest_id
    order by parent_id nulls first, position asc;
end;
$$;
