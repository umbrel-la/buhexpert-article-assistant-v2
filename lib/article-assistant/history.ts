import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { ChatTurn } from "@/types";

export type HistoryRecord = {
  sessionId: string;
  requestId: string;
  articleSlug: string;
  question: string;
  history: ChatTurn[];
  userId?: string;
  mode: "demo" | "real";
  createdAt: string;
  answer?: string;
};

// An optional durable-volume adapter for a self-hosted pilot. Never use Vercel's
// ephemeral filesystem as a database; replace this boundary with the site's DB.
function recordPath(sessionId: string, requestId: string, demo: boolean) {
  const directory = process.env.ASSISTANT_HISTORY_DIR;
  if (!directory) return null;
  if (!isAbsolute(directory) || process.env.VERCEL)
    throw new Error(
      "History requires an absolute path on a persistent server volume",
    );
  const id = createHash("sha256")
    .update(`${demo}:${sessionId}:${requestId}`)
    .digest("hex");
  return { directory, file: join(directory, `${id}.json`) };
}

export async function readHistory(
  sessionId: string,
  requestId: string,
  demo: boolean,
): Promise<HistoryRecord | null> {
  const path = recordPath(sessionId, requestId, demo);
  if (!path) return null;
  try {
    return JSON.parse(
      await readFile(/* turbopackIgnore: true */ path.file, "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveHistory(record: HistoryRecord) {
  const path = recordPath(
    record.sessionId,
    record.requestId,
    record.mode === "demo",
  );
  if (!path) return;
  await mkdir(path.directory, { recursive: true, mode: 0o700 });
  const temp = `${path.file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(record, null, 2), { mode: 0o600 });
  await rename(temp, path.file);
}

export async function bindHistory(
  sessionId: string,
  requestId: string,
  userId: string | undefined,
  demo: boolean,
) {
  const record = await readHistory(sessionId, requestId, demo);
  if (record && userId) await saveHistory({ ...record, userId });
}
