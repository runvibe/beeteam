/** Reads assistant audio without routing it to the speakers a second time. */
export class VoiceOutputMeter {
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private analyser?: AnalyserNode;
  private frame?: number;
  private level = 0;
  private closed = false;
  private onLevel: (level: number) => void;

  constructor(onLevel: (level: number) => void) {
    this.onLevel = onLevel;
    try {
      if (!globalThis.AudioContext) return;
      this.context = new AudioContext();
      // Construct and resume during the call-start gesture for autoplay policies.
      void this.context.resume().catch(() => this.close());
    } catch {
      this.close();
    }
  }

  attach(stream: MediaStream) {
    if (this.closed || !this.context) return;
    this.disconnect();
    try {
      this.source = this.context.createMediaStreamSource(stream);
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 1024;
      this.analyser = analyser;
      this.source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const sample = () => {
        if (this.closed) return;
        try {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const value of samples) sum += value * value;
          const amplitude = Math.sqrt(sum / samples.length);
          const target = amplitude < 0.004 ? 0 : Math.min(1, amplitude * 6);
          this.level +=
            (target - this.level) * (target > this.level ? 0.42 : 0.16);
          if (this.level < 0.001) this.level = 0;
          this.onLevel(this.level);
          this.frame = requestAnimationFrame(sample);
        } catch {
          this.close();
        }
      };
      this.frame = requestAnimationFrame(sample);
    } catch {
      this.close();
    }
  }

  private disconnect() {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.source = undefined;
    this.analyser = undefined;
    this.level = 0;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.disconnect();
    this.onLevel(0);
    if (this.context) void this.context.close().catch(() => {});
    this.context = undefined;
  }
}
