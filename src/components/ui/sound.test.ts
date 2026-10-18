import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AudioContext をモジュール内で使い回すので、テストごとに読み込み直す
async function loadSound() {
  vi.resetModules();
  return import("./sound");
}

function mockAudioContext() {
  const createOscillator = vi.fn(() => ({
    type: "",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  const createGain = vi.fn(() => ({
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  }));
  const Constructor = vi.fn(function (this: Record<string, unknown>) {
    this.currentTime = 0;
    this.state = "running";
    this.destination = {};
    this.createOscillator = createOscillator;
    this.createGain = createGain;
    this.resume = vi.fn();
  });
  vi.stubGlobal("AudioContext", Constructor);
  return { Constructor, createOscillator };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("isSoundEnabled / setSoundEnabled", () => {
  it("未設定なら音はオン", async () => {
    const { isSoundEnabled } = await loadSound();
    expect(isSoundEnabled()).toBe(true);
  });

  it("オフにすると false になり、localStorage に off を保存する", async () => {
    const { isSoundEnabled, setSoundEnabled } = await loadSound();
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    expect(localStorage.getItem("trione:sound")).toBe("off");
  });

  it("localStorage の読み取りが失敗したら音なしとして扱う", async () => {
    const { isSoundEnabled } = await loadSound();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(isSoundEnabled()).toBe(false);
  });

  it("localStorage の書き込みが失敗しても例外を出さない", async () => {
    const { setSoundEnabled } = await loadSound();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => setSoundEnabled(false)).not.toThrow();
  });
});

describe("playSfx", () => {
  it("何度鳴らしても AudioContext は 1 つだけ作る", async () => {
    const { playSfx } = await loadSound();
    const { Constructor, createOscillator } = mockAudioContext();
    playSfx("check");
    playSfx("check");
    playSfx("check");
    expect(Constructor).toHaveBeenCalledTimes(1);
    expect(createOscillator.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("音がオフなら鳴らさない", async () => {
    const { playSfx, setSoundEnabled } = await loadSound();
    const { createOscillator } = mockAudioContext();
    setSoundEnabled(false);
    playSfx("select");
    expect(createOscillator).not.toHaveBeenCalled();
  });

  it("AudioContext が無い環境でも例外を出さない", async () => {
    const { playSfx } = await loadSound();
    vi.stubGlobal("AudioContext", undefined);
    expect(() => playSfx("clear")).not.toThrow();
  });
});

describe("vibrate", () => {
  it("navigator.vibrate がある端末では指定した長さで振動させる", async () => {
    const { vibrate } = await loadSound();
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrateMock, configurable: true });
    vibrate(30);
    expect(vibrateMock).toHaveBeenCalledWith(30);
    Reflect.deleteProperty(navigator, "vibrate");
  });

  it("navigator.vibrate が無い端末でも例外を出さない", async () => {
    const { vibrate } = await loadSound();
    expect(() => vibrate(30)).not.toThrow();
  });
});
