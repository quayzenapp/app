import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** File storage behind one small interface, so S3 can replace local disk later. Keys are generated here, never from a file name. */
// Runtime paths, so the bundler must not try to trace them.
const root = () => path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data/files"));
const KEY = /^[a-z0-9]{10,40}\/[0-9a-f-]{36}$/;
function resolve(key: string) {
  if (!KEY.test(key)) throw new Error("Invalid storage key");
  return path.join(/*turbopackIgnore: true*/ root(), key);
}
export const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
export async function saveFile(organizationId: string, bytes: Uint8Array) {
  const key = `${organizationId}/${randomUUID()}`;
  const file = resolve(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "wx" });
  return key;
}
export const readStored = (key: string) => readFile(resolve(key));
export const deleteStored = (key: string) => rm(resolve(key), { force: true });
