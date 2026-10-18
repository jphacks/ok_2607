-- 抽選はskipped_countのみで決定する。旧重みとその制約を削除する。
alter table public.tasks drop column weight;
