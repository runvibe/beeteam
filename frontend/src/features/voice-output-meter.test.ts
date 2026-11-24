import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceOutputMeter } from "./voice-output-meter";

let amplitude = 0;
let nextFrame = 0;
const frames = new Map<number, FrameRequestCallback>();
const source = { connect: vi.fn(), disconnect: vi.fn() };
const analyser = {
  fftSize: 0,
  disconnect: vi.fn(),
  getFloatTimeDomainData: vi.fn((samples: Float32Array) =>
    samples.fill(amplitude),
  ),
};
const context = {
  resume: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
  createMediaStreamSource: vi.fn(() => source),
  createAnalyser: vi.fn(() => analyser),
};
function tick() {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(0));
}
beforeEach(() => {
  vi.clearAllMocks();
  amplitude = 0;
  frames.clear();
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        return context;
      }
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("assistant output meter", () => {
  it("samples the supplied remote stream and reacts to audio amplitude", () => {
    const level = vi.fn();
    const meter = new VoiceOutputMeter(level);
    const output = {} as MediaStream;
    meter.attach(output);
    tick();
    expect(level).toHaveBeenLastCalledWith(0);
    amplitude = 0.12;
    tick();
    expect(level.mock.lastCall![0]).toBeGreaterThan(0.25);
    expect(context.createMediaStreamSource).toHaveBeenCalledExactlyOnceWith(
      output,
    );
    expect(source.connect).toHaveBeenCalledExactlyOnceWith(analyser);
    amplitude = 0;
    for (let i = 0; i < 45; i++) tick();
    expect(level).toHaveBeenLastCalledWith(0);
    meter.close();
  });
  it("releases frames, nodes and AudioContext on close", () => {
    const level = vi.fn();
    const meter = new VoiceOutputMeter(level);
    meter.attach({} as MediaStream);
    expect(frames.size).toBe(1);
    meter.close();
    meter.close();
    expect(frames.size).toBe(0);
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(analyser.disconnect).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    expect(level).toHaveBeenLastCalledWith(0);
  });
  it("disconnects an old stream before analysing a replacement", () => {
    const meter = new VoiceOutputMeter(vi.fn());
    meter.attach({} as MediaStream);
    meter.attach({} as MediaStream);
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(frames.size).toBe(1);
    meter.close();
  });
  it("degrades safely when Web Audio is unavailable or fails", () => {
    vi.stubGlobal("AudioContext", undefined);
    const meter = new VoiceOutputMeter(vi.fn());
    expect(() => {
      meter.attach({} as MediaStream);
      meter.close();
    }).not.toThrow();
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("unavailable");
        }
      },
    );
    expect(() => new VoiceOutputMeter(vi.fn()).close()).not.toThrow();
  });
});
