import { describe, expect, it } from "vitest";
import {
  buildConfettiKeyframes,
  CONFETTI_COLOR_CLASSES,
  createConfettiParticles,
} from "./confetti";

const viewport = { width: 390, height: 844 };

/** 決まった値を順に返す乱数 */
const sequence = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("createConfettiParticles", () => {
  it("左右それぞれ指定した数の粒子を作る", () => {
    const particles = createConfettiParticles({ viewport, countPerSide: 5, random: () => 0.5 });
    expect(particles).toHaveLength(10);
    expect(particles.filter((p) => p.side === "left")).toHaveLength(5);
    expect(particles.filter((p) => p.side === "right")).toHaveLength(5);
    expect(new Set(particles.map((p) => p.id)).size).toBe(10);
  });

  it("左は画面左下から右上へ、右は画面右下から左上へ飛ぶ", () => {
    const particles = createConfettiParticles({ viewport, countPerSide: 3, random: () => 0.5 });
    for (const p of particles) {
      if (p.side === "left") {
        expect(p.originX).toBeLessThan(viewport.width / 2);
        expect(p.driftX).toBeGreaterThan(0);
      } else {
        expect(p.originX).toBeGreaterThan(viewport.width / 2);
        expect(p.driftX).toBeLessThan(0);
      }
      expect(p.peakHeight).toBeGreaterThan(0);
    }
  });

  it("乱数が最小・最大でも値が範囲に収まり、演出は 3 秒以内に終わる", () => {
    for (const value of [0, 0.999999]) {
      const particles = createConfettiParticles({ viewport, countPerSide: 2, random: () => value });
      for (const p of particles) {
        expect(Math.abs(p.driftX)).toBeGreaterThanOrEqual(viewport.width * 0.15 - 1e-6);
        expect(Math.abs(p.driftX)).toBeLessThanOrEqual(viewport.width * 0.6);
        expect(p.peakHeight).toBeGreaterThanOrEqual(viewport.height * 0.35 - 1e-6);
        expect(p.peakHeight).toBeLessThanOrEqual(viewport.height * 0.75);
        expect([6, 8]).toContain(p.size);
        expect(p.duration).toBeGreaterThanOrEqual(2000);
        expect(p.duration + p.delay).toBeLessThanOrEqual(3000);
        expect(CONFETTI_COLOR_CLASSES).toContain(p.colorClass);
      }
    }
  });

  it("乱数に応じて色が変わる", () => {
    const random = sequence([0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.95]);
    const [first, second] = createConfettiParticles({ viewport, countPerSide: 1, random });
    expect(first.colorClass).toBe(CONFETTI_COLOR_CLASSES[0]);
    expect(second.colorClass).toBe(CONFETTI_COLOR_CLASSES[CONFETTI_COLOR_CLASSES.length - 1]);
  });
});

describe("buildConfettiKeyframes", () => {
  const [particle] = createConfettiParticles({ viewport, countPerSide: 1, random: () => 0.5 });

  it("0 から 1 までのキーフレームを作り、最初は起点で見えていて最後は消える", () => {
    const frames = buildConfettiKeyframes(particle, 10);
    expect(frames).toHaveLength(11);
    expect(frames[0].offset).toBe(0);
    expect(frames[10].offset).toBe(1);
    expect(frames[0].transform).toMatch(/^translate\(0px, -?0px\) rotate\(0deg\)$/);
    expect(frames[0].opacity).toBe(1);
    expect(frames[10].opacity).toBe(0);
  });

  it("最高点まで上がってから落ちる", () => {
    const frames = buildConfettiKeyframes(particle, 20);
    const ys = frames.map((f) => Number(/translate\([^,]+, (-?[\d.]+)px\)/.exec(f.transform)?.[1]));
    const highest = Math.min(...ys);
    expect(highest).toBeCloseTo(-particle.peakHeight, 0);
    const peakIndex = ys.indexOf(highest);
    expect(peakIndex).toBeGreaterThan(0);
    expect(peakIndex).toBeLessThan(frames.length - 1);
    expect(ys[ys.length - 1]).toBeGreaterThan(highest);
  });
});
