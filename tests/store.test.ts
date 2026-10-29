import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buddy-"));
process.env.BUDDY_DATA_DIR = dir;
delete process.env.DATABASE_URL;

describe("file store", () => {
  let store: typeof import("@/lib/store");
  beforeAll(async () => {
    store = await import("@/lib/store");
  });

  it("returns defaults for a fresh install", async () => {
    const app = await store.readApp();
    expect(app.users).toEqual([]);
    expect(app.settings.models.interviewer).toBe("claude-opus-5-5");
  });

  it("keeps users' data separate and syncs session summaries", async () => {
    const a = "usr_aaaaaa";
    const b = "usr_bbbbbb";
    await store.updateDb(a, (d) => {
      d.profile.name = "Ali";
    });
    expect((await store.readDb(a)).profile.name).toBe("Ali");
    expect((await store.readDb(b)).profile.name).toBe("");
    const id = store.newId("ses");
    await store.writeSession(a, {
      id,
      jobId: "job_1",
      resumeId: "cv_1",
      type: "hr",
      language: "en",
      difficulty: "realistic",
      lengthMin: 10,
      createdAt: new Date().toISOString(),
      status: "live",
      rubricVersion: "v1",
      plan: { openingLine: "Hi", interviewerName: "A", interviewerTitle: "B", questions: [], weakPointsToProbe: [] },
      turns: [],
      repeatRequests: 0,
    });
    await store.updateSession(a, id, (s) => {
      s.status = "done";
      s.overall = 70;
    });
    const summary = (await store.readDb(a)).sessions.find((s) => s.id === id)!;
    expect(summary.overall).toBe(70);
    expect(summary).not.toHaveProperty("turns");
    expect(await store.readSession(b, id)).toBeNull();
    await store.saveAudio(a, id, "a1.wav", Buffer.from("abc"));
    expect((await store.readAudio(a, id, "a1.wav"))?.toString()).toBe("abc");
    await store.deleteSession(a, id);
    expect(await store.readSession(a, id)).toBeNull();
    expect(await store.readAudio(a, id, "a1.wav")).toBeNull();
  });

  it("rejects path traversal in ids", async () => {
    await expect(store.readDb("../etc")).rejects.toThrow();
    expect(await store.readSession("usr_aaaaaa", "../../x")).toBeNull();
  });
});
