import * as path from 'path';
import * as fs from 'fs';
import simpleGit from 'simple-git';
import { Extension, getExtensionDir } from './types';
import logger from '../utils/logger';


const js_path = '/path/to/js'; // Change this to your JS path

export async function gitRepoHasUpdates(dirPath: string, doFetch: boolean, doUpdate: boolean): Promise<boolean> {
    const git = simpleGit(dirPath);

    if (doFetch) {
        await git.fetch();
    }

    const status = await git.status();

    if (status.behind > 0 || (doUpdate && status.ahead > 0)) {
        if (doUpdate) {
            await git.pull();
        }
        return true;
    }

    return false;
}

export async function checkAExtensionInstalled(item: Extension, doFetch = false, doUpdateCheck = true, doUpdate = false): Promise<void> {
    const custom_nodes_path = getExtensionDir();
    item.installed = false;
    item.need_update = false;
    item.disabled = false;

    if (item.install_type === "git-clone" && item.files.length === 1) {
        let url = item.files[0];

        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }

        const dirName = path.parse(url).name.replace('.git', '');
        const dirPath = path.join(custom_nodes_path, dirName);

        if (fs.existsSync(dirPath)) {
            try {
                if (doUpdateCheck && (await gitRepoHasUpdates(dirPath, doFetch, doUpdate))) {
                    item.need_update = true;
                    item.installed = true;
                } else {
                    item.installed = true;
                }
            } catch {
                item.installed = true;
            }
        }
        
        if (fs.existsSync(dirPath + '.disabled')) {
            item.disabled = true;
        }

    } else if (item.install_type === 'copy' && item.files.length === 1) {
        const dirName = path.basename(item.files[0]);
        let base_path;

        if (item.files[0].endsWith('.py')) {
            base_path = custom_nodes_path;
        } else if (item.js_path) {
            base_path = path.join(js_path, item.js_path);
        } else {
            base_path = js_path;
        }

        const filePath = path.join(base_path, dirName);

        if (fs.existsSync(filePath)) {
            item.installed = true;
        }
        
        if (fs.existsSync(filePath + '.disabled')) {
            item.disabled = true;
        }
    }
}

export async function checkExtensionsInstalled(extensions: Extension[], doFetch = true, doUpdateCheck = true, doUpdate = false): Promise<void> {
    if (doFetch) {
        logger.verbose('Start fetching...');
    } else if (doUpdate) {
        logger.verbose('Start updating...');
    } else if (doUpdateCheck) {
        logger.verbose('Start update check...');
    }

    async function processExtension(item: Extension): Promise<void> {
        await checkAExtensionInstalled(item, doFetch, doUpdateCheck, doUpdate);
    }

    await Promise.all(extensions.map(processExtension));

    if (doFetch) {
        logger.verbose('\x1b[2K\rFetching done.');
    } else if (doUpdate) {
        const updateExists = extensions.some((item) => item.need_update);
        if (updateExists) {
            logger.verbose('\x1b[2K\rUpdate done.');
        } else {
            logger.verbose('\x1b[2K\rAll extensions are already up-to-date.');
        }
    } else if (doUpdateCheck) {
        logger.verbose('\x1b[2K\rUpdate check done.');
    }
}

