import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type SherlockConfig = {
  SHERLOCK_PROVIDER?: string;
  SHERLOCK_API_KEY?: string;
  SHERLOCK_MODEL?: string;
  SHERLOCK_API_URL?: string;
  SHERLOCK_REFERER?: string;
  SHERLOCK_APP_NAME?: string;
};

const CONFIG_DIR = join(homedir(), ".sherlook");
const LEGACY_CONFIG_DIR = join(homedir(), ".sherlock");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const LEGACY_CONFIG_PATH = join(LEGACY_CONFIG_DIR, "config.json");

export async function loadConfig(): Promise<SherlockConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as SherlockConfig;
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      try {
        const legacyRaw = await readFile(LEGACY_CONFIG_PATH, "utf8");
        return JSON.parse(legacyRaw) as SherlockConfig;
      } catch (legacyError) {
        if (
          legacyError &&
          (legacyError as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return {};
        }
        throw legacyError;
      }
    }
    throw error;
  }
}

export async function saveConfig(config: SherlockConfig): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  const payload = JSON.stringify(config, null, 2);
  await writeFile(CONFIG_PATH, `${payload}\n`, "utf8");
}

export async function clearConfig(): Promise<void> {
  try {
    await rm(CONFIG_PATH);
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      try {
        await rm(LEGACY_CONFIG_PATH);
      } catch (legacyError) {
        if (
          legacyError &&
          (legacyError as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return;
        }
        throw legacyError;
      }
      return;
    }
    throw error;
  }
}
