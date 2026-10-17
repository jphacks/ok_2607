import { describe, expect, it, vi } from "vitest";
import { AiGenerationError, generateCheckpointPlan, type GenerateContentClient } from "./generate";

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
});
