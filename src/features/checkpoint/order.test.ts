import { describe, expect, it } from "vitest";
import type { Checkpoint } from "@/lib/schemas";
import { childCheckpointsOf, computeCheckpointFocus, sortParentCheckpoints } from "./order";

function cp(id: string, position: number, isDone: boolean, parentId: string | null = null) {
  return {
    id,
    questId: "q",
    parentId,
    title: id,
    description: null,
    position,
    isDone,
    doneAt: isDone ? "2026-10-18T00:00:00Z" : null,
  } satisfies Checkpoint;
}

describe("sortParentCheckpoints", () => {
  it("親だけを position 順に並べる", () => {
    const result = sortParentCheckpoints([
      cp("b", 1, false),
      cp("child", 0, false, "a"),
      cp("a", 0, false),
    ]);
    expect(result.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("computeCheckpointFocus", () => {
  it("最初の未完了が今やるもの。直前の完了済みだけ解除でき、他はロックされる", () => {
    const focus = computeCheckpointFocus([
      cp("c", 2, false),
      cp("a", 0, true),
      cp("b", 1, true),
      cp("d", 3, false),
    ]);

    expect(focus.current?.id).toBe("c");
    expect(focus.steps.map((s) => [s.checkpoint.id, s.state, s.canToggle])).toEqual([
      ["a", "done", false],
      ["b", "done", true],
      ["c", "current", true],
      ["d", "locked", false],
    ]);
    expect(focus.completedCount).toBe(2);
    expect(focus.totalCount).toBe(4);
    expect(focus.isAllCompleted).toBe(false);
  });

  it("1 つも完了していなければ先頭が今やるもので、解除できるものは無い", () => {
    const focus = computeCheckpointFocus([cp("a", 0, false), cp("b", 1, false)]);
    expect(focus.current?.id).toBe("a");
    expect(focus.steps.filter((s) => s.canToggle).map((s) => s.checkpoint.id)).toEqual(["a"]);
  });

  it("全部完了していれば今やるものは無く、最後の 1 つだけ解除できる", () => {
    const focus = computeCheckpointFocus([cp("a", 0, true), cp("b", 1, true)]);
    expect(focus.current).toBeNull();
    expect(focus.isAllCompleted).toBe(true);
    expect(focus.steps.map((s) => s.canToggle)).toEqual([false, true]);
  });

  it("今やるものより後ろにある完了済みはロック扱いにする", () => {
    const focus = computeCheckpointFocus([cp("a", 0, false), cp("b", 1, true)]);
    expect(focus.steps[1]).toMatchObject({ state: "locked", canToggle: false });
  });

  it("チェックポイントが無ければ完了扱いにしない", () => {
    const focus = computeCheckpointFocus([]);
    expect(focus.current).toBeNull();
    expect(focus.isAllCompleted).toBe(false);
  });
});

describe("childCheckpointsOf", () => {
  it("指定した親の子を position 順に返す", () => {
    const result = childCheckpointsOf(
      [cp("y", 1, false, "p"), cp("x", 0, false, "p"), cp("z", 0, false, "other")],
      "p",
    );
    expect(result.map((c) => c.id)).toEqual(["x", "y"]);
  });
});
