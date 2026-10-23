import type { Analysis, ConcernId, ConcernScores, Effect, ToneReading } from "@/lib/types";

/** Image handle passed through the loop. `remoteUrl` lets live mode chain renders without re-uploading. */
export interface ImageRef {
  buf: Buffer;
  hash: string;
  remoteUrl?: string;
}

export interface RenderOut {
  buf: Buffer;
  remoteUrl?: string;
}

export interface AnalyzeHint {
  /** demo-mode only: lets the simulator derive plausible post-makeup scores */
  baseline?: ConcernScores;
  effects?: Effect[];
  /** demo-mode only: stage 2 simulates a real-world application */
  realWorld?: boolean;
}

export interface Engine {
  mode: "live" | "demo";
  analyze(src: ImageRef, concerns: ConcernId[], hint?: AnalyzeHint): Promise<Pick<Analysis, "scores" | "overlays" | "overall">>;
  tone(src: ImageRef): Promise<ToneReading>;
  render(src: ImageRef, effects: Effect[]): Promise<RenderOut>;
}

export class EngineError extends Error {
  constructor(
    message: string,
    public code = "engine_error",
    public detail?: unknown,
  ) {
    super(message);
  }
}
