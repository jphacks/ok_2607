import { describe, expect, it, vi } from "vitest";
import {
  AiGenerationError,
  CheckpointPlanSchema,
  createFallbackCheckpointPlan,
  generateCheckpointPlan,
  type GenerateContentClient,
} from "./generate";

vi.mock("@/lib/gemini", () => ({
  gemini: vi.fn(),
  geminiModel: () => "mock-model",
}));

describe("generateCheckpointPlan", () => {
  it("正常な JSON レスポンスから CheckpointPlan を生成できる", async () => {
    const mockPlan = {
      milestones: [
        {
          title: "文献の検索条件を決める",
          description: "調べるテーマを明確にする",
          steps: [
            {
              title: "レポートのテーマからキーワードを3つ抽出する",
              description: "メモ帳に書き出す",
            },
            {
              title: "CiNii または Google Scholar をブラウザで開く",
              description: null,
            },
          ],
        },
        {
          title: "参考文献を3本選定する",
          description: "概要を読んで使えそうなものを保存する",
          steps: [
            {
              title: "検索結果からタイトルと抄録を5本確認する",
              description: null,
            },
            {
              title: "候補の3本をダウンロードまたはブックマークする",
              description: "URLを控えておく",
            },
          ],
        },
      ],
    };

    const mockClient: GenerateContentClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify(mockPlan),
        }),
      },
    };

    const result = await generateCheckpointPlan("レポートの参考文献を3本探す", {
      client: mockClient,
      model: "custom-model",
    });

    expect(result).toEqual(mockPlan);
    expect(mockClient.models.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "custom-model",
        contents: expect.stringContaining("レポートの参考文献を3本探す"),
      }),
    );
  });

  it("Gemini API の呼び出しでエラーが発生した場合、AiGenerationError を投げる", async () => {
    const mockClient: GenerateContentClient = {
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error("API quota exceeded")),
      },
    };

    await expect(
      generateCheckpointPlan("レポートの参考文献を3本探す", {
        client: mockClient,
      }),
    ).rejects.toThrow(AiGenerationError);
  });

  it("レスポンスが空文字列の場合、AiGenerationError を投げる", async () => {
    const mockClient: GenerateContentClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: "",
        }),
      },
    };

    await expect(
      generateCheckpointPlan("レポートの参考文献を3本探す", {
        client: mockClient,
      }),
    ).rejects.toThrow(AiGenerationError);
  });

  it("レスポンスが壊れた JSON の場合、AiGenerationError を投げる", async () => {
    const mockClient: GenerateContentClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: "{ invalid json ...",
        }),
      },
    };

    await expect(
      generateCheckpointPlan("レポートの参考文献を3本探す", {
        client: mockClient,
      }),
    ).rejects.toThrow(AiGenerationError);
  });

  it("レスポンスのスキーマが合致しない場合（milestones が空配列など）、AiGenerationError を投げる", async () => {
    const mockClient: GenerateContentClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({ milestones: [] }),
        }),
      },
    };

    await expect(
      generateCheckpointPlan("レポートの参考文献を3本探す", {
        client: mockClient,
      }),
    ).rejects.toThrow(AiGenerationError);
  });

  it("ステップの title が空文字の場合、AiGenerationError を投げる", async () => {
    const mockClient: GenerateContentClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            milestones: [
              {
                title: "全体像",
                steps: [{ title: "   " }],
              },
            ],
          }),
        }),
      },
    };

    await expect(
      generateCheckpointPlan("タスク", {
        client: mockClient,
      }),
    ).rejects.toThrow(AiGenerationError);
  });

  it("マイルストーンが上限（5件）を超える場合、AiGenerationError を投げる", async () => {
    const tooManyMilestones = Array.from({ length: 6 }, (_, i) => ({
      title: `全体像${i + 1}`,
      steps: [{ title: `ステップ${i + 1}` }],
    }));

    const mockClient: GenerateContentClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({ milestones: tooManyMilestones }),
        }),
      },
    };

    await expect(
      generateCheckpointPlan("タスク", {
        client: mockClient,
      }),
    ).rejects.toThrow(AiGenerationError);
  });
});

describe("createFallbackCheckpointPlan", () => {
  it("有効な CheckpointPlanSchema を満たすフォールバックプランを生成する", () => {
    const plan = createFallbackCheckpointPlan("レポートの参考文献を3本探す");
    const result = CheckpointPlanSchema.safeParse(plan);

    expect(result.success).toBe(true);
    expect(plan.milestones.length).toBeGreaterThanOrEqual(1);
    expect(plan.milestones.length).toBeLessThanOrEqual(5);

    // タスク名がステップに含まれていること
    const allTitles = plan.milestones.flatMap((m) => [m.title, ...m.steps.map((s) => s.title)]);
    expect(allTitles.some((t) => t.includes("レポートの参考文献を3本探す"))).toBe(true);
  });

  it("タスク名が空白または空文字の場合でも安全にフォールバックプランを生成できる", () => {
    const plan = createFallbackCheckpointPlan("   ");
    const result = CheckpointPlanSchema.safeParse(plan);

    expect(result.success).toBe(true);
    const allTitles = plan.milestones.flatMap((m) => [m.title, ...m.steps.map((s) => s.title)]);
    expect(allTitles.some((t) => t.includes("タスク"))).toBe(true);
  });
});
