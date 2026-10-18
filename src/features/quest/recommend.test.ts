import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/schemas";
import { recommendTasks } from "@/features/quest/recommend";

const now = new Date("2026-10-17T12:00:00.000Z");

function task(id: number, overrides: Partial<Task> = {}): Task {
  return {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    title: `タスク${id}`,
    dueAt: null,
    status: "active",
    shownCount: 0,
    skippedCount: 0,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
    ...overrides,
  };
}

describe("recommendTasks", () => {
  it("24時間ちょうどの締切を緊急の1択にする", () => {
    const urgent = task(2, { dueAt: "2026-10-18T12:00:00.000Z", skippedCount: 100 });
    expect(recommendTasks([task(1), urgent], { now, random: () => 0 })).toEqual({
      isUrgent: true,
      candidates: [urgent],
    });
  });

  it("24時間を1ミリ秒過ぎる締切は緊急にしない", () => {
    const normal = task(1, { dueAt: "2026-10-18T12:00:00.001Z" });
    expect(recommendTasks([normal], { now })).toEqual({
      isUrgent: false,
      candidates: [normal],
    });
  });

  it("期限切れと非activeを除外し、現在時刻ちょうどの締切は緊急候補に含める", () => {
    const dueNow = task(2, { dueAt: now.toISOString() });
    const tasks = [
      task(1, { dueAt: now.toISOString(), status: "done" }),
      dueNow,
      task(3, { dueAt: "2026-10-17T11:59:59.999Z" }),
      task(4, { dueAt: now.toISOString(), status: "in_quest" }),
      task(5, { dueAt: now.toISOString(), status: "discarded" }),
    ];
    expect(recommendTasks(tasks, { now, random: () => 0.99 })).toEqual({
      isUrgent: true,
      candidates: [dueNow],
    });
  });

  it("期限切れが残っていても、期限なし・24時間超の候補を通常抽選できる", () => {
    const overdue = task(1, { dueAt: "2026-10-17T11:59:59.999Z" });
    const noDeadline = task(2);
    const future = task(3, { dueAt: "2026-10-18T12:00:00.001Z" });
    expect(recommendTasks([overdue, noDeadline, future], { now, random: () => 0 })).toEqual({
      isUrgent: false,
      candidates: [noDeadline, future],
    });
  });

  it("期限切れのタスクしかなければ通常候補も緊急候補も返さない", () => {
    expect(
      recommendTasks(
        [
          task(1, { dueAt: "2026-10-17T11:59:59.999Z" }),
          task(2, { dueAt: "2026-10-16T12:00:00.000Z" }),
        ],
        { now },
      ),
    ).toEqual({ isUrgent: false, candidates: [] });
  });

  it("activeタスクが0件なら空配列を返す", () => {
    expect(recommendTasks([task(1, { status: "done" })], { now })).toEqual({
      isUrgent: false,
      candidates: [],
    });
  });

  it("3件未満なら全件を重複なく返し、入力を変更しない", () => {
    const tasks = [task(1), task(2)];
    const result = recommendTasks(tasks, { now, random: () => 0 });
    expect(result.candidates.map((candidate) => candidate.id)).toEqual([tasks[0].id, tasks[1].id]);
    expect(tasks).toHaveLength(2);
  });

  it.each([
    [0, 0],
    [4 / 7 - 0.000001, 0],
    [4 / 7, 1],
    [6 / 7 - 0.000001, 1],
    [6 / 7, 2],
    [0.999999, 2],
  ])("reject回数[0,1,3]を正規化し、乱数%sで候補%sを選ぶ", (random, index) => {
    const tasks = [task(1), task(2, { skippedCount: 1 }), task(3, { skippedCount: 3 })];
    expect(recommendTasks(tasks, { now, random: () => random }).candidates[0].id).toBe(
      tasks[index].id,
    );
  });

  it("選択済みを除いたスコアで再抽選し、最大3件を重複なく返す", () => {
    const tasks = [
      task(1),
      task(2, { skippedCount: 1 }),
      task(3, { skippedCount: 3 }),
      task(4, { skippedCount: 3 }),
    ];
    const result = recommendTasks(tasks, { now, random: () => 0.6 });
    expect(result.candidates.map((candidate) => candidate.id)).toEqual([
      tasks[1].id,
      tasks[0].id,
      tasks[3].id,
    ]);
  });

  it.each([0, 5])("reject回数が全て%sなら等確率で抽選する", (skippedCount) => {
    const tasks = [task(1, { skippedCount }), task(2, { skippedCount }), task(3, { skippedCount })];
    expect(
      recommendTasks(tasks, { now, random: () => 0.99 }).candidates.map(
        (candidate) => candidate.id,
      ),
    ).toEqual([tasks[2].id, tasks[1].id, tasks[0].id]);
  });

  it("reject回数がDB整数の上限でも候補から消えない", () => {
    const tasks = [task(1), task(2, { skippedCount: 2147483647 })];
    expect(recommendTasks(tasks, { now, random: () => 0.9999999999 }).candidates[0].id).toBe(
      tasks[1].id,
    );
  });
});
