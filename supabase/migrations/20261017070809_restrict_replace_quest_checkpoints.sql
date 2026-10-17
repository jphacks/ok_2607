-- replace_quest_checkpoints を anon キーから呼べないようにする。
-- PostgreSQL の既定では関数の EXECUTE 権限が PUBLIC に付くため、anon キーでも
-- /rest/v1/rpc/replace_quest_checkpoints を呼べてしまい、security definer により RLS を
-- 迂回して任意のクエストのチェックポイントを書き換えられた。
-- サーバーは service_role で呼ぶので（RLS を通過できる）、security definer は不要。

alter function public.replace_quest_checkpoints(uuid, jsonb) security invoker;

-- 関数内で別スキーマの同名オブジェクトを参照しないよう search_path を固定する
-- （本体のテーブルは public. で修飾済み、jsonb 関数は pg_catalog なので常に解決できる）
alter function public.replace_quest_checkpoints(uuid, jsonb) set search_path = '';

revoke execute on function public.replace_quest_checkpoints(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_quest_checkpoints(uuid, jsonb) to service_role;

-- 今後 public スキーマに作る関数も、既定では anon / authenticated から実行できないようにする。
-- 実行させたい関数があれば、そのマイグレーションで明示的に grant する。
-- PUBLIC への既定の付与はスキーマ指定なしでしか外せない。anon / authenticated への付与は
-- Supabase が public スキーマに設定しているので、スキーマ指定で外す。
alter default privileges revoke execute on functions from public;
alter default privileges in schema public
  revoke execute on functions from anon, authenticated;
