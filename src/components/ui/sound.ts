"use client";

import { useSyncExternalStore } from "react";

/*
 * 効果音と振動。音声ファイルは置かず、Web Audio API で短いピコ音を生成する。
 * 音のオン・オフは localStorage に保存し、使えない環境では音なしとして動く。
 */

export type SfxName = "flip" | "select" | "check" | "clear" | "levelUp";

const STORAGE_KEY = "trione:sound";

/** 1 音の高さ（Hz）と長さ（秒）。順に鳴らす */
const SFX_NOTES: Record<SfxName, ReadonlyArray<{ freq: number; duration: number }>> = {
  flip: [{ freq: 880, duration: 0.05 }],
  select: [
    { freq: 660, duration: 0.06 },
    { freq: 990, duration: 0.06 },
  ],
  check: [{ freq: 1320, duration: 0.08 }],
  clear: [
    { freq: 523, duration: 0.06 },
    { freq: 659, duration: 0.06 },
    { freq: 784, duration: 0.06 },
  ],
  levelUp: [
    { freq: 523, duration: 0.05 },
    { freq: 659, duration: 0.05 },
    { freq: 784, duration: 0.05 },
    { freq: 1047, duration: 0.05 },
  ],
};

const VOLUME = 0.08;

const listeners = new Set<() => void>();
let audioContext: AudioContext | null = null;

export function isSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return false;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // 保存できない環境では何もしない（音なしとして動く）
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 音のオン・オフと切り替え関数を返す。画面をまたいで同じ設定を共有する */
export function useSoundEnabled(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, isSoundEnabled, () => false);
  return [enabled, setSoundEnabled];
}

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") return null;
  audioContext = new window.AudioContext();
  return audioContext;
}

export function playSfx(name: SfxName): void {
  if (!isSoundEnabled()) return;
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();

    let startAt = context.currentTime;
    for (const note of SFX_NOTES[name]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(note.freq, startAt);
      gain.gain.setValueAtTime(VOLUME, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + note.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + note.duration);
      startAt += note.duration;
    }
  } catch {
    // 音が鳴らせなくても操作は続けられるようにする
  }
}

export function vibrate(ms: number): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(ms);
  } catch {
    // 振動できない端末では何もしない
  }
}
