import { uuid } from "@comflowy/common";
import { getExtensionDir } from "./types";
import * as fsExtra from 'fs-extra';
import path from 'path';
import logger from "../utils/logger";

/**
 * Find all frontend extensions
 */
export async function findAllFrontendExtensions<T = any>(): Promise<T[]> {
  try {
    const custom_nodes_path = getExtensionDir();
    const extensions: any[] = [];
    const files = await fsExtra.readdir(custom_nodes_path);
    for (const file of files) {
      const filePath = path.join(custom_nodes_path, file);
      const stat = await fsExtra.stat(filePath);
      if (stat.isDirectory()) {
        const disabledPath = filePath + '.disabled';
        if (await fsExtra.exists(disabledPath)) {
          continue
        }
        const manifestPath = path.join(filePath, 'manifest.json');
        if (await fsExtra.exists(manifestPath)) {
          const manifestData = await fsExtra.readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestData);
          if (!manifest.main) {
            continue
          }
          manifest.main = path.join("custom_nodes", file, manifest.main);
          if (manifest.ui) {
            manifest.ui = path.join("custom_nodes", file, manifest.ui);
          }
          manifest.id = filePath + "-" + manifest.name + "-" + uuid();
          extensions.push(manifest);
        }
      }
    }
    return extensions;
  } catch (err: any) {
    logger.info("findAllFrontendExtensions:", err);
    return [];
  }
}