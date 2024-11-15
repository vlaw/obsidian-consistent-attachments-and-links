import {
  App,
  TFile
} from 'obsidian';
import {getAttachmentFilePath} from 'obsidian-dev-utils/obsidian/AttachmentPath';
import {
  getFile,
  getFileOrNull,
  isNote
} from 'obsidian-dev-utils/obsidian/FileSystem';
import {
  extractLinkFile,
  splitSubpath,
  testEmbed
} from 'obsidian-dev-utils/obsidian/Link';
import {
  getAllLinks,
  getCacheSafe
} from 'obsidian-dev-utils/obsidian/MetadataCache';
import {
  copySafe,
  createFolderSafe,
  deleteEmptyFolderHierarchy,
  getAvailablePath,
  listSafe,
  renameSafe
} from 'obsidian-dev-utils/obsidian/Vault';
import { dirname, join, normalize } from 'obsidian-dev-utils/Path';
import { Md5 } from "ts-md5";

import type { PathChangeInfo } from './links-handler.ts';

import { LinksHandler } from './links-handler.ts';
import { trimStart } from "obsidian-dev-utils/String";

export interface MovedAttachmentResult {
  movedAttachments: PathChangeInfo[];
  renamedFiles: PathChangeInfo[];
}

export class FilesHandler {
  public constructor(
    private app: App,
    private lh: LinksHandler,
    private consoleLogPrefix = '',
    private ignoreFolders: string[] = [],
    private ignoreFilesRegex: RegExp[] = [],
    private shouldDeleteEmptyFolders = false
  ) { }

  private async createFolderForAttachmentFromPath(filePath: string): Promise<void> {
    await createFolderSafe(this.app, dirname(filePath));
  }

  private async deleteFile(file: TFile, deleteEmptyFolders: boolean): Promise<void> {
    await this.app.fileManager.trashFile(file);
    if (deleteEmptyFolders) {
      let dir = file.parent;
      while (dir && dir.children.length === 0) {
        await this.app.fileManager.trashFile(dir);
        dir = dir.parent;
      }
    }
  }

  private isAttachment(file: TFile): boolean {
    return !isNote(file);
  }

  private isPathIgnored(path: string): boolean {
    if (path.startsWith('./')) {
      path = path.slice(2);
    }

    for (const folder of this.ignoreFolders) {
      if (path.startsWith(folder)) {
        return true;
      }
    }

    for (const fileRegex of this.ignoreFilesRegex) {
      const testResult = fileRegex.test(path);
      if (testResult) {
        return true;
      }
    }

    return false;
  }

  private async getCustomizedNewPath(app: App, notePath: string, attachmentFile: TFile, id: string): Promise<string> {

    async function generateValidBaseName(app: App, attachment: TFile) {
      let data = await app.vault.readBinary(attachment);
      const buf = Buffer.from(data);
      let md5 = new Md5();
      md5.appendByteArray(buf);
      return md5.end() as string;
    }

    /**
     * Normalizes a path by combining multiple slashes into a single slash and removing leading and trailing slashes.
     * @param path - Path to normalize.
     * @returns The normalized path.
     */
    function normalizeSlashes(path: string): string {
      path = path.replace(/([\\/])+/g, '/');
      path = path.replace(/(^\/+|\/+$)/g, '');
      return path || '/';
    }

    const basename = await generateValidBaseName(app, attachmentFile);
    const filename = `${basename}.${attachmentFile.extension}`;

    const noteFile = getFile(app, notePath)
    // console.log("notefile.parent", noteFile.parent?.path);
    // console.log("notefile.prefix", noteFile.parent?.getParentPrefix());

    let attachmentFolderPath = app.vault.getConfig('attachmentFolderPath') as string;
    const isCurrentFolder = attachmentFolderPath === '.' || attachmentFolderPath === './';
    let relativePath = null;

    if (attachmentFolderPath.startsWith('./')) {
      relativePath = trimStart(attachmentFolderPath, './');
    }

    if (isCurrentFolder) {
      attachmentFolderPath = noteFile ? noteFile.parent?.path ?? '' : '';
    } else if (relativePath) {
      attachmentFolderPath = (noteFile? noteFile.parent?.getParentPrefix() ?? '' : '') + relativePath;
    }

    attachmentFolderPath = normalize(normalizeSlashes(attachmentFolderPath));

    const newPath = join(attachmentFolderPath, id, filename);
    return newPath;
  }

  private async moveAttachment(file: TFile, newLinkPath: string, parentNotePaths: string[], deleteExistFiles: boolean, deleteEmptyFolders: boolean): Promise<MovedAttachmentResult> {
    const path = file.path;

    const result: MovedAttachmentResult = {
      movedAttachments: [],
      // 目标文件已存在, 且不能覆盖的情况下, 使用rename
      renamedFiles: []
    };

    if (this.isPathIgnored(path)) {
      return result;
    }

    if (!this.isAttachment(file)) {
      return result;
    }

    if (path == newLinkPath) {
      console.warn(this.consoleLogPrefix + 'Can\'t move file. Source and destination path the same.');
      return result;
    }

    await this.createFolderForAttachmentFromPath(newLinkPath);

    const linkedNotes = await this.lh.getCachedNotesThatHaveLinkToFile(path);
    for (const notePath of parentNotePaths) {
      linkedNotes.remove(notePath);
    }

    if (path !== file.path) {
      console.warn(this.consoleLogPrefix + 'File was moved already');
      return await this.moveAttachment(file, newLinkPath, parentNotePaths, deleteExistFiles, deleteEmptyFolders);
    }

    const oldFolder = file.parent;
    if (linkedNotes.length == 0) {
      const existFile = getFileOrNull(this.app, newLinkPath);
      if (!existFile) {
        console.log(`linkedNotes.1(独占链接, 目标文件不存在, 移动, 记录移动)`);
        console.log(this.consoleLogPrefix + 'move file [from, to]: \n   ' + path + '\n   ' + newLinkPath);
        result.movedAttachments.push({ newPath: newLinkPath, oldPath: path });
        await renameSafe(this.app, file, newLinkPath);
      } else {
        if (deleteExistFiles) {
          console.log("linkedNotes.2(独占链接, 目标文件已存在, 删除, 记录移动)");
          console.log(this.consoleLogPrefix + 'delete file: \n   ' + path);
          result.movedAttachments.push({ newPath: newLinkPath, oldPath: path });
          await this.deleteFile(file, deleteEmptyFolders);
        } else {
          console.log("linkedNotes.3(独占链接, 目标文件已存在, 不删除, 自动重命名, 记录重命名");
          const newFileCopyName = getAvailablePath(this.app, newLinkPath);
          console.log(this.consoleLogPrefix + 'copy file with new name [from, to]: \n   ' + path + '\n   ' + newFileCopyName);
          result.movedAttachments.push({ newPath: newFileCopyName, oldPath: path });
          await renameSafe(this.app, file, newFileCopyName);
          result.renamedFiles.push({ newPath: newFileCopyName, oldPath: newLinkPath });
        }
      }
    } else {
      const existFile = getFileOrNull(this.app, newLinkPath);
      if (!existFile) {
        console.log("linkedNotes.4(复用链接, 目标文件不存在)");
        console.log(this.consoleLogPrefix + 'copy file [from, to]: \n   ' + path + '\n   ' + newLinkPath);
        result.movedAttachments.push({ newPath: newLinkPath, oldPath: path });
        // await renameSafe(this.app, file, newLinkPath);
        // await copySafe(this.app, file, path);
        await copySafe(this.app, file, newLinkPath);
      } else if (!deleteExistFiles) {
        console.log("linkedNotes.5");
        const newFileCopyName = getAvailablePath(this.app, newLinkPath);
        console.log(this.consoleLogPrefix + 'copy file with new name [from, to]: \n   ' + path + '\n   ' + newFileCopyName);
        result.movedAttachments.push({ newPath: newFileCopyName, oldPath: file.path });
        await renameSafe(this.app, file, newFileCopyName);
        await copySafe(this.app, file, path);
        result.renamedFiles.push({ newPath: newFileCopyName, oldPath: newLinkPath });
      } else {
        console.log("linkedNotes.6");
        result.movedAttachments.push({oldPath: file.path, newPath: newLinkPath});
      }
    }

    if (this.shouldDeleteEmptyFolders) {
      await deleteEmptyFolderHierarchy(this.app, oldFolder);
    }
    return result;
  }

  public async collectAttachmentsForCachedNote(notePath: string,
    deleteExistFiles: boolean, deleteEmptyFolders: boolean, customized: boolean): Promise<MovedAttachmentResult> {
    if (this.isPathIgnored(notePath)) {
      return { movedAttachments: [], renamedFiles: [] };
    }

    const result: MovedAttachmentResult = {
      movedAttachments: [],
      renamedFiles: []
    };

    const cache = await getCacheSafe(this.app, notePath);

    if (!cache) {
      return result;
    }

    const keyId = cache.frontmatter?.["ID"];
    if (!keyId) {
      new Notice(`Missing 'ID' in frontmatter of ${notePath}`, 1000);
      return result;
    }
    const id = keyId as string;

    for (const link of getAllLinks(cache)) {
      const { linkPath } = splitSubpath(link.link);

      if (!linkPath) {
        continue;
      }

      const fullPathLink = this.lh.getFullPathForLink(linkPath, notePath);
      if (result.movedAttachments.findIndex((x) => x.oldPath == fullPathLink) != -1) {
        continue;
      }

      const file = extractLinkFile(this.app, link, notePath);
      if (!file) {
        const type = testEmbed(link.original) ? 'embed' : 'link';
        console.warn(`${this.consoleLogPrefix}${notePath} has bad ${type} (file does not exist): ${linkPath}`);
        continue;
      }

      if (!this.isAttachment(file)) {
        continue;
      }

      const newPath = !customized ? await getAttachmentFilePath(this.app, file.path, notePath)
        : await this.getCustomizedNewPath(this.app, notePath, file, id);

      const res = await this.moveAttachment(file, newPath, [notePath], deleteExistFiles, deleteEmptyFolders);

      result.movedAttachments = result.movedAttachments.concat(res.movedAttachments);
      result.renamedFiles = result.renamedFiles.concat(res.renamedFiles);
    }

    return result;
  }

  public async deleteEmptyFolders(dirName: string): Promise<void> {
    if (this.isPathIgnored(dirName)) {
      return;
    }

    if (dirName.startsWith('./')) {
      dirName = dirName.slice(2);
    }

    let list = await listSafe(this.app, dirName);
    for (const folder of list.folders) {
      await this.deleteEmptyFolders(folder);
    }

    list = await listSafe(this.app, dirName);
    if (list.files.length == 0 && list.folders.length == 0) {
      console.log(this.consoleLogPrefix + 'delete empty folder: \n   ' + dirName);
      if (await this.app.vault.exists(dirName)) {
        try {
          await this.app.vault.adapter.rmdir(dirName, false);
        } catch (e) {
          if (await this.app.vault.adapter.exists(dirName)) {
            throw e;
          }
        }
      }
    }
  }
}
