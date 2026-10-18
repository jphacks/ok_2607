/**
 * クエストクリア時のクラッカー演出（紙吹雪）の粒子を作る純粋関数。
 * 乱数は引数で差し替えられるので、テストでは固定値を渡す。
 */

export type ConfettiSide = "left" | "right";

/** 紙吹雪の色。tokens.css のトークンを Tailwind のクラスで使う */
export const CONFETTI_COLOR_CLASSES = [
  "bg-gold-accent",
  "bg-gold-hover",
  "bg-success",
  "bg-danger",
  "bg-text",
] as const;

export type ConfettiColorClass = (typeof CONFETTI_COLOR_CLASSES)[number];

export interface ConfettiParticle {
  id: number;
  side: ConfettiSide;
  /** 発射位置（画面左端からの px、画面下端が起点） */
  originX: number;
  /** 横方向に進む距離（px。右向きが正） */
  driftX: number;
  /** 打ち上がる最高点の高さ（px。上向きが正） */
  peakHeight: number;
  /** 最高点から消えるまでに落ちる距離（px） */
  fallDistance: number;
  /** 一辺の大きさ（px。ドット絵に合わせた正方形） */
  size: number;
  /** 回転量（deg） */
  rotation: number;
  /** 開始までの遅れ（ms） */
  delay: number;
  /** 全体の長さ（ms） */
  duration: number;
  /** 最高点に届く時点（0〜1、duration に対する割合） */
  peakAt: number;
  colorClass: ConfettiColorClass;
}

export interface ConfettiOptions {
  /** 画面の幅と高さ（px） */
  viewport: { width: number; height: number };
  /** 片側あたりの粒子数 */
  countPerSide?: number;
  /** 0 以上 1 未満の乱数を返す関数 */
  random?: () => number;
}

const between = (random: () => number, min: number, max: number) => min + (max - min) * random();

/** 画面下の左右 2 か所から斜め上に飛び出す紙吹雪の粒子を作る */
export function createConfettiParticles({
  viewport,
  countPerSide = 24,
  random = Math.random,
}: ConfettiOptions): ConfettiParticle[] {
  const { width, height } = viewport;
  const sides: ConfettiSide[] = ["left", "right"];
  const particles: ConfettiParticle[] = [];

  for (const side of sides) {
    const direction = side === "left" ? 1 : -1;
    for (let i = 0; i < countPerSide; i += 1) {
      const colorIndex = Math.min(
        CONFETTI_COLOR_CLASSES.length - 1,
        Math.floor(random() * CONFETTI_COLOR_CLASSES.length),
      );
      particles.push({
        id: particles.length,
        side,
        originX: side === "left" ? width * 0.06 : width * 0.94,
        driftX: direction * width * between(random, 0.15, 0.6),
        peakHeight: height * between(random, 0.35, 0.75),
        fallDistance: height * between(random, 0.25, 0.45),
        size: random() < 0.5 ? 6 : 8,
        rotation: direction * between(random, 180, 540),
        delay: Math.round(between(random, 0, 160)),
        duration: Math.round(between(random, 2000, 2700)),
        peakAt: between(random, 0.25, 0.35),
        colorClass: CONFETTI_COLOR_CLASSES[colorIndex],
      });
    }
  }

  return particles;
}

export type ConfettiKeyframe = {
  offset: number;
  transform: string;
  opacity: number;
};

/**
 * 粒子の軌跡を Web Animations API のキーフレームにする。
 * 最高点までは減速しながら上がり、その後は重力でゆっくり落ちながら消える。
 */
export function buildConfettiKeyframes(particle: ConfettiParticle, steps = 12): ConfettiKeyframe[] {
  const { driftX, peakHeight, fallDistance, rotation, peakAt } = particle;
  const keyframes: ConfettiKeyframe[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    // 横方向は空気抵抗で減速する
    const x = (driftX * (1 - Math.exp(-4 * t))) / (1 - Math.exp(-4));
    let y: number;
    if (t <= peakAt) {
      const r = t / peakAt;
      y = peakHeight * (1 - (1 - r) * (1 - r));
    } else {
      const r = (t - peakAt) / (1 - peakAt);
      y = peakHeight - fallDistance * r * r;
    }
    const opacity = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
    keyframes.push({
      offset: t,
      transform: `translate(${round(x)}px, ${round(-y)}px) rotate(${round(rotation * t)}deg)`,
      opacity: round(opacity),
    });
  }

  return keyframes;
}

const round = (value: number) => Math.round(value * 100) / 100;
