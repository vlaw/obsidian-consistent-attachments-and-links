import {
  App,
  TFile
} from 'obsidian';
import { getAttachmentFilePath } from 'obsidian-dev-utils/obsidian/AttachmentPath';
import {
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
import { dirname } from 'obsidian-dev-utils/Path';
import {Md5} from "ts-md5";

import type { PathChangeInfo } from './links-handler.ts';
import { LinksHandler } from './links-handler.ts';

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

  private isPathIgnored(path: string): boolean {
    if (path.startsWith('./')) {
      path = path.substring(2);
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

  private async createFolderForAttachmentFromPath(filePath: string): Promise<void> {
    await createFolderSafe(this.app, dirname(filePath));
  }

  private async generateValidBaseName(file: TFile) {
    // let file = this.lh.getFileByPath(filePath);
    console.log(`generateValidBaseName ${file.path}`);
    let data = await this.app.vault.readBinary(file);
    const buf = Buffer.from(data);

    // var crypto = require('crypto');
    // let hash: string = crypto.createHash('md5').update(buf).digest("hex");

    let md5 = new Md5();
    md5.appendByteArray(buf);
    return md5.end() as string;
  }

  /**
   *
   * @param notePath
   * @param deleteExistFiles
   * @param deleteEmptyFolders
   * @param customized
   */
  public async collectAttachmentsForCachedNote(notePath: string,
                                               deleteExistFiles: boolean, deleteEmptyFolders: boolean, customized = false): Promise<MovedAttachmentResult> {
    if (this.isPathIgnored(notePath)) {
      return { movedAttachments: [], renamedFiles: [] };
    }

    const result: MovedAttachmentResult = {
      movedAttachments: [],
      renamedFiles: []
    };

    // 获取当前文件(或路径)里的 CacheMetadata
    const cache = await getCacheSafe(this.app, notePath);

    if (!cache) {
      return result;
    }

    const id: string = cache.frontmatter ? cache.frontmatter["ID"] as string : "123";

    for (const link of getAllLinks(cache)) {
      const { linkPath } = splitSubpath(link.link);

      if (!linkPath) {
        continue;
      }

      const fullPathLink = this.lh.getFullPathForLink(linkPath, notePath);
      // 不过滤可能造成重复移动同一个文件(oldPath唯一)
      if (result.movedAttachments.findIndex((x) => x.oldPath == fullPathLink) != -1) {
        continue;
      }

      const file = extractLinkFile(this.app, link, notePath);
      if (!file) {
        // embed: 以 '![' 开头(也可以是双[), 形如:
        // 1. ![[./ link]],
        // 2. ![title](./ link),
        // 3. ![title](<./ link>).
        //
        // link:
        // 1. [[./ link]]
        // 2. [title](./ link)
        // 3. [title](<./ link>),
        const type = testEmbed(link.original) ? 'embed' : 'link';
        // 文件是文件不存在, 而不是type. type只是一个类型,用来做提示用的.
        console.warn(`${this.consoleLogPrefix}${notePath} has bad ${type} (file does not exist): ${linkPath}`);
        continue;
      }

      console.warn(`2.1.1 link: ${link.link}, fullPath: ${fullPathLink}, file path: ${file?.path}`);
      if (!this.isAttachment(file)) {
        continue;
      }

      const basename = await this.generateValidBaseName(file);
      console.log(`basename: ${basename}`);

      //分支, 自定义命名
      const newPath = !customized ? await getAttachmentFilePath(this.app, file.path, notePath)
        : `assets/${id}/${basename}.${file.extension}`;
      console.log(`2.1.2 newPath: ${newPath}`);

      // 新老路径是同一目录(但是也要重命名啊)
      // if (dirname(newPath) === dirname(file.path)) {
      //   continue;
      // }

      const res = await this.moveAttachment(file, newPath, [notePath], deleteExistFiles, deleteEmptyFolders);

      result.movedAttachments = result.movedAttachments.concat(res.movedAttachments);
      result.renamedFiles = result.renamedFiles.concat(res.renamedFiles);
    }

    return result;
  }

  /**
   *
   * @param file (待移动的)附件
   * @param newLinkPath 目标地址
   * @param parentNotePaths
   * @param deleteExistFiles
   * @param deleteEmptyFolders
   * @private
   */
  private async moveAttachment(file: TFile, newLinkPath: string, parentNotePaths: string[], deleteExistFiles: boolean, deleteEmptyFolders: boolean): Promise<MovedAttachmentResult> {
    const path = file.path;

    console.log("2.1.2.1 moveAttachment ", file, newLinkPath);
    const result: MovedAttachmentResult = {
      movedAttachments: [],
      renamedFiles: []
    };

    if (this.isPathIgnored(path)) {
      return result;
    }

    if (!this.isAttachment(file)) {
      return result;
    }

    // 源地址和目标地址一致, 警告并返回
    if (path == newLinkPath) {
      console.warn(this.consoleLogPrefix + 'Can\'t move file. Source and destination path the same.');
      return result;
    }

    await this.createFolderForAttachmentFromPath(newLinkPath);

    // 链接到当前附件的Note(backlink to attachments), 排除当前的Note
    const linkedNotes = await this.lh.getCachedNotesThatHaveLinkToFile(path);
    for (const notePath of parentNotePaths) {
      linkedNotes.remove(notePath);
    }

    // 没看懂, 怎么可能?
    if (path !== file.path) {
      console.warn(this.consoleLogPrefix + 'File was moved already');
      return await this.moveAttachment(file, newLinkPath, parentNotePaths, deleteExistFiles, deleteEmptyFolders);
    }

    const oldFolder = file.parent;
    // 对于该附件, 没有额外的backlink
    if (linkedNotes.length == 0) {
      // 查找目标文件是否已经存在
      const existFile = getFileOrNull(this.app, newLinkPath);
      if (!existFile) {
        console.log(this.consoleLogPrefix + 'move file [from, to]: \n   ' + path + '\n   ' + newLinkPath);
        result.movedAttachments.push({ oldPath: path, newPath: newLinkPath });
        // renameSafe中使用的是Vault.rename, 而不是Adaptor中的(其他链接跟随式更新)
        await renameSafe(this.app, file, newLinkPath);
      } else {
        // 文件已存在, 1) 删除; 2) 获取别的可用路径(AvailablePath)
        if (deleteExistFiles) {
          console.log(this.consoleLogPrefix + 'delete file: \n   ' + path);
          result.movedAttachments.push({ oldPath: path, newPath: newLinkPath });
          await this.deleteFile(file, deleteEmptyFolders);
        } else {
          const newFileCopyName = getAvailablePath(this.app, newLinkPath);
          console.log(this.consoleLogPrefix + 'copy file with new name [from, to]: \n   ' + path + '\n   ' + newFileCopyName);
          result.movedAttachments.push({ oldPath: path, newPath: newFileCopyName });
          await renameSafe(this.app, file, newFileCopyName);
          result.renamedFiles.push({ oldPath: newLinkPath, newPath: newFileCopyName });
          // 放到了result的rename中(而不是move)
        }
      }
    } else {
      // 有backlink
      const existFile = getFileOrNull(this.app, newLinkPath);
      if (!existFile) {
        console.log(this.consoleLogPrefix + 'copy file [from, to]: \n   ' + path + '\n   ' + newLinkPath);
        result.movedAttachments.push({ oldPath: path, newPath: newLinkPath });

        // 目标文件不存在, 为什么不是直接重命名就可以了?
        //
        // 这个插件希望解除这个"一个附件多个Note(backlink)"的场景,这样可以保证一个笔记的闭环(含附件)
        // 先把文件重命名到新的, 然后把文件复制会原来的地址(path)
        // await renameSafe(this.app, file, newLinkPath);
        // await copySafe(this.app, file, path);
        await copySafe(this.app, file, newLinkPath);

      } else if (!deleteExistFiles) {
        // 只有当已存在目标文件, 且不做对原始目标文件的删除操作的时候, 才会需要将rename放到result中
        // 1. 文件一, 符合目标名的原始文件, origin0
        // 2. 待处理的文件二, origin
        // 3. 目标文件, dest; (origin0 == dest; availablePath = dest-1)
        // mv origin dest-1 (newFileCopyName);
        // cp dest(newLinkPath) dest-1
        const newFileCopyName = getAvailablePath(this.app, newLinkPath);
        console.log(this.consoleLogPrefix + 'copy file with new name [from, to]: \n   ' + path + '\n   ' + newFileCopyName);
        result.movedAttachments.push({ oldPath: file.path, newPath: newFileCopyName });
        await renameSafe(this.app, file, newFileCopyName);
        await copySafe(this.app, file, path);
        result.renamedFiles.push({ oldPath: newLinkPath, newPath: newFileCopyName });
      } else {
        // 在有多个backlink的场景里, 目标文件已存在(同一Note里可能?)
        console.warn(`原插件泄露的分支情况:${existFile}, delete: ${deleteExistFiles}`);
        result.movedAttachments.push({oldPath: file.path, newPath: newLinkPath});
        // 目标文件已经存在, 其实不用删除了, 在覆盖过去
      }
    }

    if (this.shouldDeleteEmptyFolders) {
      await deleteEmptyFolderHierarchy(this.app, oldFolder);
    }
    return result;
  }

  public async deleteEmptyFolders(dirName: string): Promise<void> {
    if (this.isPathIgnored(dirName)) {
      return;
    }

    if (dirName.startsWith('./')) {
      dirName = dirName.substring(2);
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

  private async deleteFile(file: TFile, deleteEmptyFolders: boolean): Promise<void> {
    await this.app.fileManager.trashFile(file);
    // 向上回溯删除空目录
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
}
