import { describe, expect, it } from "vitest";
import { noiseFloor, voiceThreshold } from "@/lib/client/recorder";

describe("voice detection noise floor", () => {
  it("absorbs steady room noise so pauses are still detected", () => {
    const fan = Array(70).fill(-40); // a loud fan, 3 s
    expect(noiseFloor(fan)).toBe(-40);
    expect(-40 > voiceThreshold(noiseFloor(fan))).toBe(false); // the fan alone is not speech
  });
  it("keeps the floor low while he is talking (gaps between words)", () => {
    const talking = Array.from({ length: 70 }, (_, i) => (i % 4 === 0 ? -48 : -22));
    expect(noiseFloor(talking)).toBe(-48);
    expect(-22 > voiceThreshold(noiseFloor(talking))).toBe(true);
  });
  it("stays within sane limits", () => {
    expect(voiceThreshold(-90)).toBe(-52);
    expect(voiceThreshold(-5)).toBe(-25);
    expect(noiseFloor([])).toBe(-55);
  });
});
