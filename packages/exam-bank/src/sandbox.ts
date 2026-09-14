// Copyright (c) Mike Argento. All rights reserved. See LICENSE.

/**
 * Run a model-written JavaScript function against hidden inputs in a child
 * `node --permission` process: no filesystem beyond the entry script, no
 * child processes, no workers, a 5 s wall clock and a 64 MB heap. The
 * function must be named f. Output is one JSON array of results; anything
 * that is not exactly that (a throw, a timeout, a stray console.log) is a
 * failed check, never a crash of the grader.
 *
 * Limit, stated: --permission does not close sockets. The grader runs
 * offline and the function is a few lines; this is a fence, not a vault.
 */
import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HARNESS = `
const __inputs = JSON.parse(process.argv[2]);
const __out = __inputs.map((xs) => { try { const r = f(xs.slice()); return (typeof r === "number" && Number.isFinite(r)) ? r : null; } catch { return null; } });
process.stdout.write("\\n@@RESULT@@" + JSON.stringify(__out));
`;

export async function runSandboxed(code: string, inputs: number[][], timeoutMs = 5000): Promise<Array<number | null> | null> {
  // The real path: macOS keeps /var as a symlink to /private/var, and the
  // permission model resolves the entry through it.
  const dir = await mkdtemp(join(await realpath(tmpdir()), "exam-sandbox-"));
  const file = join(dir, "candidate.js");
  try {
    await writeFile(file, `${code}\n${HARNESS}`);
    const stdout = await new Promise<string | null>((resolve) => {
      execFile(
        process.execPath,
        ["--permission", `--allow-fs-read=${file}`, "--max-old-space-size=64", file, JSON.stringify(inputs)],
        { timeout: timeoutMs, maxBuffer: 1 << 20, env: {}, windowsHide: true },
        (err, out) => resolve(err ? null : String(out)),
      );
    });
    if (stdout === null) return null;
    const at = stdout.lastIndexOf("\n@@RESULT@@");
    if (at < 0) return null;
    const parsed = JSON.parse(stdout.slice(at + "\n@@RESULT@@".length)) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
