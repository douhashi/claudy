import path from 'path';
import os from 'os';
import { glob } from 'glob';
import fsExtra from 'fs-extra';
const fs = fsExtra;
import inquirer from 'inquirer';
import { logger } from './logger.js';
import { t } from './i18n.js';
import { ClaudyError } from '../types/index.js';
import { ErrorCodes, wrapError } from '../types/errors.js';
import { collectReferences, ReferencedFile } from './reference-parser.js';

export interface FileSelectionResult {
  files: string[];
  baseDir: string;
}

/**
 * ファイル検索結果
 */
export interface FileSearchResult {
  mainFiles: string[];
  referencedFiles: ReferencedFile[];
}

/**
 * Claude関連ファイルを検索（参照ファイルを含む）
 * @param baseDir - 検索を開始するディレクトリ
 * @param includeReferences - 参照ファイルを含めるかどうか
 * @returns 見つかったファイルの情報
 * @throws {Error} ファイル検索中にエラーが発生した場合（ログに記録される）
 */
export async function findClaudeFiles(
  baseDir: string,
  includeReferences: boolean = true
): Promise<FileSearchResult> {
  const patterns = [
    'CLAUDE.md',
    'CLAUDE.local.md',
    '.claude/**/*.md'
  ];
  
  const mainFiles: string[] = [];
  
  for (const pattern of patterns) {
    try {
      const matches = await glob(pattern, {
        cwd: baseDir,
        absolute: false,
        nodir: true,
        dot: true, // .claudeディレクトリを含む
      });
      mainFiles.push(...matches);
    } catch (error) {
      logger.debug(t('common:fileSelection.patternError', { pattern, error }));
    }
  }
  
  // 重複を削除してソート
  const uniqueMainFiles = [...new Set(mainFiles)].sort();
  
  // 参照ファイルを収集
  let referencedFiles: ReferencedFile[] = [];
  if (includeReferences) {
    const processedFiles = new Set<string>();
    
    for (const file of uniqueMainFiles) {
      const refs = await collectReferences(file, baseDir, processedFiles);
      
      // 参照ファイルをマージ
      for (const ref of refs) {
        const existing = referencedFiles.find(rf => rf.path === ref.path);
        if (existing) {
          // 参照元情報をマージ
          for (const from of ref.referredFrom) {
            if (!existing.referredFrom.includes(from)) {
              existing.referredFrom.push(from);
            }
          }
        } else {
          referencedFiles.push(ref);
        }
      }
    }
    
    // メインファイルと重複する参照ファイルを除外
    referencedFiles = referencedFiles.filter(
      ref => !uniqueMainFiles.includes(ref.path)
    );
  }
  
  return {
    mainFiles: uniqueMainFiles,
    referencedFiles
  };
}

/**
 * ユーザーレベルのClaude関連ファイルを検索
 * @param includeReferences - 参照ファイルを含めるかどうか
 * @returns 見つかったファイルの情報
 * @throws {Error} ファイル検索中にエラーが発生した場合（ログに記録される）
 */
export async function findUserClaudeFiles(
  includeReferences: boolean = true
): Promise<{ files: FileSearchResult, baseDir: string }> {
  const homeDir = os.homedir();
  const userClaudeDir = path.join(homeDir, '.claude');
  const mainFiles: string[] = [];
  
  // ~/.claude/CLAUDE.md
  const userClaudeMd = path.join(userClaudeDir, 'CLAUDE.md');
  if (await fs.pathExists(userClaudeMd)) {
    mainFiles.push('.claude/CLAUDE.md');
  }
  
  // ~/.claude/commands/**/*.md
  try {
    const commandFiles = await glob('commands/**/*.md', {
      cwd: userClaudeDir,
      absolute: false,
      nodir: true,
    });
    mainFiles.push(...commandFiles.map(f => path.join('.claude', f)));
  } catch (error) {
    logger.debug(`Error searching user-level command files: ${error}`);
  }
  
  // 参照ファイルを収集
  let referencedFiles: ReferencedFile[] = [];
  if (includeReferences && mainFiles.length > 0) {
    const processedFiles = new Set<string>();
    
    for (const file of mainFiles) {
      const refs = await collectReferences(file, homeDir, processedFiles);
      
      // 参照ファイルをマージ
      for (const ref of refs) {
        const existing = referencedFiles.find(rf => rf.path === ref.path);
        if (existing) {
          // 参照元情報をマージ
          for (const from of ref.referredFrom) {
            if (!existing.referredFrom.includes(from)) {
              existing.referredFrom.push(from);
            }
          }
        } else {
          referencedFiles.push(ref);
        }
      }
    }
    
    // メインファイルと重複する参照ファイルを除外
    referencedFiles = referencedFiles.filter(
      ref => !mainFiles.includes(ref.path)
    );
  }
  
  return { 
    files: {
      mainFiles,
      referencedFiles
    }, 
    baseDir: homeDir 
  };
}

/**
 * ファイルパスを見やすい形式に変換
 * @param filePath - 変換するファイルパス
 * @param baseDir - 基準ディレクトリ
 * @param isUserLevel - ユーザーレベルのファイルかどうか
 * @returns 見やすい形式のパス
 */
export function formatFilePath(filePath: string, baseDir: string, isUserLevel: boolean = false): string {
  if (isUserLevel) {
    return `~/${filePath}`;
  }
  
  // プロジェクトレベルのファイルは相対パスで表示
  const relPath = path.relative(process.cwd(), path.join(baseDir, filePath));
  
  // 現在のディレクトリの場合は./を付ける
  if (!relPath.startsWith('..') && !path.isAbsolute(relPath)) {
    return `./${relPath}`;
  }
  
  return relPath;
}

interface FileChoice {
  name: string;
  value: string;
  checked: boolean;
  short?: string;
}

type GroupSelectionOption = 'both' | 'project' | 'user' | 'custom';

/**
 * グループ選択プロンプトを表示
 * @param hasProjectFiles - プロジェクトファイルが存在するか
 * @param hasUserFiles - ユーザーファイルが存在するか
 * @returns 選択されたグループ
 */
async function selectGroup(hasProjectFiles: boolean, hasUserFiles: boolean): Promise<GroupSelectionOption> {
  const choices: Array<{ name: string; value: GroupSelectionOption }> = [];
  
  if (hasProjectFiles && hasUserFiles) {
    choices.push(
      { name: '両方のファイル（プロジェクトレベル + ユーザーレベル）', value: 'both' },
      { name: 'プロジェクトレベルのファイルのみ', value: 'project' },
      { name: 'ユーザーレベルのファイルのみ', value: 'user' },
      { name: 'カスタム選択（個別にファイルを選択）', value: 'custom' }
    );
  } else if (hasProjectFiles) {
    choices.push(
      { name: 'プロジェクトレベルのファイルをすべて選択', value: 'project' },
      { name: 'カスタム選択（個別にファイルを選択）', value: 'custom' }
    );
  } else if (hasUserFiles) {
    choices.push(
      { name: 'ユーザーレベルのファイルをすべて選択', value: 'user' },
      { name: 'カスタム選択（個別にファイルを選択）', value: 'custom' }
    );
  }
  
  const { selection } = await inquirer.prompt<{ selection: GroupSelectionOption }>({
    type: 'list',
    name: 'selection',
    message: 'ファイルの選択方法を選んでください:',
    choices,
    default: hasProjectFiles && hasUserFiles ? 'both' : (hasProjectFiles ? 'project' : 'user'),
  });
  
  return selection;
}

/**
 * チェックボックス付きでファイルを選択（デフォルト選択状態をサポート）
 * @param projectFiles - プロジェクトレベルのファイル情報
 * @param userFiles - ユーザーレベルのファイル情報
 * @param userBaseDir - ユーザーレベルの基準ディレクトリ
 * @param defaultSelection - デフォルトの選択状態を決定する関数
 * @returns 選択されたファイルの情報
 * @throws {ClaudyError} ファイルが見つからない場合
 */
export async function selectFilesWithCheckbox(
  projectFiles: FileSearchResult,
  userFiles: FileSearchResult,
  userBaseDir: string,
  defaultSelection?: (file: string, isUserLevel: boolean, isReference: boolean) => boolean
): Promise<FileSelectionResult[]> {
  const results: FileSelectionResult[] = [];
  const choices: Array<FileChoice | typeof inquirer.Separator.prototype> = [];
  
  // デフォルト選択関数（指定されていない場合はすべて選択）
  const shouldCheck = defaultSelection || ((): boolean => true);
  
  // プロジェクトレベルのメインファイル
  if (projectFiles.mainFiles.length > 0) {
    choices.push(new inquirer.Separator('--- Project level ---'))
    
    for (const file of projectFiles.mainFiles) {
      choices.push({
        name: formatFilePath(file, process.cwd(), false),
        value: `project:${file}`,
        checked: shouldCheck(file, false, false),
      });
    }
  }
  
  // プロジェクトレベルの参照ファイル
  if (projectFiles.referencedFiles.length > 0) {
    if (projectFiles.mainFiles.length > 0) {
      choices.push(new inquirer.Separator(' '));
    }
    
    choices.push(new inquirer.Separator('--- Referenced files (Project) ---'));
    
    for (const refFile of projectFiles.referencedFiles) {
      const referredFromText = refFile.referredFrom.map(from => 
        formatFilePath(from, process.cwd(), false)
      ).join(', ');
      
      choices.push({
        name: `${formatFilePath(refFile.path, process.cwd(), false)} (from ${referredFromText})`,
        value: `project:${refFile.path}`,
        checked: shouldCheck(refFile.path, false, true),
      });
    }
  }
  
  // ユーザーレベルのメインファイル
  if (userFiles.mainFiles.length > 0) {
    if (projectFiles.mainFiles.length > 0 || projectFiles.referencedFiles.length > 0) {
      choices.push(new inquirer.Separator(' '));
    }
    
    choices.push(new inquirer.Separator('--- User level ---'));
    
    for (const file of userFiles.mainFiles) {
      choices.push({
        name: formatFilePath(file, userBaseDir, true),
        value: `user:${file}`,
        checked: shouldCheck(file, true, false),
      });
    }
  }
  
  // ユーザーレベルの参照ファイル
  if (userFiles.referencedFiles.length > 0) {
    if (userFiles.mainFiles.length > 0) {
      choices.push(new inquirer.Separator(' '));
    }
    
    choices.push(new inquirer.Separator('--- Referenced files (User) ---'));
    
    for (const refFile of userFiles.referencedFiles) {
      const referredFromText = refFile.referredFrom.map(from => 
        formatFilePath(from, userBaseDir, true)
      ).join(', ');
      
      choices.push({
        name: `${formatFilePath(refFile.path, userBaseDir, true)} (from ${referredFromText})`,
        value: `user:${refFile.path}`,
        checked: shouldCheck(refFile.path, true, true),
      });
    }
  }
  
  if (choices.length === 0) {
    throw new ClaudyError(
      'No Claude-related files found',
      ErrorCodes.NO_FILES_FOUND,
      { searchDirs: [process.cwd(), userBaseDir] }
    );
  }
  
  // ファイル選択UI表示
  const { selectedFiles } = await inquirer.prompt<{ selectedFiles: string[] }>({
    type: 'checkbox',
    name: 'selectedFiles',
    message: 'Select files to save (space to select/deselect, enter to confirm):',
    choices,
    pageSize: 15,
    validate: (input: unknown): boolean | string => {
      const selectedItems = input as string[];
      if (!selectedItems || selectedItems.length === 0) {
        return 'Please select at least one file';
      }
      return true;
    },
  });
  
  // 選択されたファイルを分類（ヘッダーや区切り文字を除外）
  const selectedProjectFiles: string[] = [];
  const selectedUserFiles: string[] = [];
  
  for (const selected of selectedFiles) {
    // ヘッダーや区切り文字をスキップ
    if (selected.includes('-header') || selected.includes('separator')) {
      continue;
    }
    
    if (selected.startsWith('project:')) {
      selectedProjectFiles.push(selected.substring(8));
    } else if (selected.startsWith('user:')) {
      selectedUserFiles.push(selected.substring(5));
    }
  }
  
  if (selectedProjectFiles.length > 0) {
    results.push({
      files: selectedProjectFiles,
      baseDir: process.cwd(),
    });
  }
  
  if (selectedUserFiles.length > 0) {
    results.push({
      files: selectedUserFiles,
      baseDir: userBaseDir,
    });
  }
  
  const totalFiles = selectedProjectFiles.length + selectedUserFiles.length;
  logger.info(t('common:fileSelection.filesSelected', { count: totalFiles }));
  
  return results;
}

/**
 * インタラクティブにファイルを選択
 * @param projectFiles - プロジェクトレベルのファイル情報
 * @param userFiles - ユーザーレベルのファイル情報
 * @param userBaseDir - ユーザーレベルの基準ディレクトリ
 * @returns 選択されたファイルの情報
 * @throws {ClaudyError} ファイルが見つからない場合
 */
export async function selectFilesInteractively(
  projectFiles: FileSearchResult,
  userFiles: FileSearchResult,
  userBaseDir: string
): Promise<FileSelectionResult[]> {
  const results: FileSelectionResult[] = [];
  
  const hasProjectFiles = projectFiles.mainFiles.length > 0 || projectFiles.referencedFiles.length > 0;
  const hasUserFiles = userFiles.mainFiles.length > 0 || userFiles.referencedFiles.length > 0;
  
  if (!hasProjectFiles && !hasUserFiles) {
    throw new ClaudyError(
      'No Claude-related files found',
      ErrorCodes.NO_FILES_FOUND,
      { searchDirs: [process.cwd(), userBaseDir] }
    );
  }
  
  // グループ選択
  const groupSelection = await selectGroup(hasProjectFiles, hasUserFiles);
  
  // グループ選択に基づいて処理
  if (groupSelection === 'both') {
    // 両方のファイルを選択
    if (hasProjectFiles) {
      const allProjectFiles = [...projectFiles.mainFiles, ...projectFiles.referencedFiles.map(rf => rf.path)];
      results.push({
        files: allProjectFiles,
        baseDir: process.cwd(),
      });
    }
    if (hasUserFiles) {
      const allUserFiles = [...userFiles.mainFiles, ...userFiles.referencedFiles.map(rf => rf.path)];
      results.push({
        files: allUserFiles,
        baseDir: userBaseDir,
      });
    }
    
    const totalFiles = 
      projectFiles.mainFiles.length + projectFiles.referencedFiles.length +
      userFiles.mainFiles.length + userFiles.referencedFiles.length;
    logger.info(t('common:fileSelection.filesSelected', { count: totalFiles }));
    return results;
  } else if (groupSelection === 'project') {
    // プロジェクトレベルのみ
    const allProjectFiles = [...projectFiles.mainFiles, ...projectFiles.referencedFiles.map(rf => rf.path)];
    results.push({
      files: allProjectFiles,
      baseDir: process.cwd(),
    });
    const totalFiles = projectFiles.mainFiles.length + projectFiles.referencedFiles.length;
    logger.info(t('common:fileSelection.projectFilesSelected', { count: totalFiles }));
    return results;
  } else if (groupSelection === 'user') {
    // ユーザーレベルのみ
    const allUserFiles = [...userFiles.mainFiles, ...userFiles.referencedFiles.map(rf => rf.path)];
    results.push({
      files: allUserFiles,
      baseDir: userBaseDir,
    });
    const totalFiles = userFiles.mainFiles.length + userFiles.referencedFiles.length;
    logger.info(t('common:fileSelection.userFilesSelected', { count: totalFiles }));
    return results;
  }
  
  // カスタム選択の場合
  const choices: Array<FileChoice | typeof inquirer.Separator.prototype> = [];
  
  // プロジェクトレベルのメインファイル
  if (projectFiles.mainFiles.length > 0) {
    choices.push(new inquirer.Separator('--- プロジェクトレベル ---'))
    
    for (const file of projectFiles.mainFiles) {
      choices.push({
        name: formatFilePath(file, process.cwd(), false),
        value: `project:${file}`,
        checked: true,
      });
    }
  }
  
  // プロジェクトレベルの参照ファイル
  if (projectFiles.referencedFiles.length > 0) {
    if (projectFiles.mainFiles.length > 0) {
      choices.push(new inquirer.Separator(' '));
    }
    
    choices.push(new inquirer.Separator('--- Referenced files (Project) ---'));
    
    for (const refFile of projectFiles.referencedFiles) {
      const referredFromText = refFile.referredFrom.map(from => 
        formatFilePath(from, process.cwd(), false)
      ).join(', ');
      
      choices.push({
        name: `${formatFilePath(refFile.path, process.cwd(), false)} (from ${referredFromText})`,
        value: `project:${refFile.path}`,
        checked: true,
      });
    }
  }
  
  // ユーザーレベルのメインファイル
  if (userFiles.mainFiles.length > 0) {
    if (projectFiles.mainFiles.length > 0 || projectFiles.referencedFiles.length > 0) {
      choices.push(new inquirer.Separator(' '));
    }
    
    choices.push(new inquirer.Separator('--- User level ---'));
    
    for (const file of userFiles.mainFiles) {
      choices.push({
        name: formatFilePath(file, userBaseDir, true),
        value: `user:${file}`,
        checked: true,
      });
    }
  }
  
  // ユーザーレベルの参照ファイル
  if (userFiles.referencedFiles.length > 0) {
    if (userFiles.mainFiles.length > 0) {
      choices.push(new inquirer.Separator(' '));
    }
    
    choices.push(new inquirer.Separator('--- Referenced files (User) ---'));
    
    for (const refFile of userFiles.referencedFiles) {
      const referredFromText = refFile.referredFrom.map(from => 
        formatFilePath(from, userBaseDir, true)
      ).join(', ');
      
      choices.push({
        name: `${formatFilePath(refFile.path, userBaseDir, true)} (from ${referredFromText})`,
        value: `user:${refFile.path}`,
        checked: true,
      });
    }
  }
  
  if (choices.length === 0) {
    throw new ClaudyError(
      'No Claude-related files found',
      ErrorCodes.NO_FILES_FOUND,
      { searchDirs: [process.cwd(), userBaseDir] }
    );
  }
  
  const { selectedFiles } = await inquirer.prompt<{ selectedFiles: string[] }>({
    type: 'checkbox',
    name: 'selectedFiles',
    message: t('commands:save.messages.selectFiles'),
    choices,
    pageSize: 15,
    validate: (input: unknown): boolean | string => {
      const selectedItems = input as string[];
      if (!selectedItems || selectedItems.length === 0) {
        return 'Please select at least one file';
      }
      return true;
    },
  });
  
  // 選択されたファイルを分類（ヘッダーや区切り文字を除外）
  const selectedProjectFiles: string[] = [];
  const selectedUserFiles: string[] = [];
  
  for (const selected of selectedFiles) {
    // ヘッダーや区切り文字をスキップ
    if (selected.includes('-header') || selected.includes('separator')) {
      continue;
    }
    
    if (selected.startsWith('project:')) {
      selectedProjectFiles.push(selected.substring(8));
    } else if (selected.startsWith('user:')) {
      selectedUserFiles.push(selected.substring(5));
    }
  }
  
  if (selectedProjectFiles.length > 0) {
    results.push({
      files: selectedProjectFiles,
      baseDir: process.cwd(),
    });
  }
  
  if (selectedUserFiles.length > 0) {
    results.push({
      files: selectedUserFiles,
      baseDir: userBaseDir,
    });
  }
  
  const totalFiles = selectedProjectFiles.length + selectedUserFiles.length;
  logger.info(`✓ ${totalFiles}個のファイルを選択しました`);
  
  return results;
}

/**
 * ファイル選択を実行（エクスポート関数）
 * @returns 選択されたファイルの情報
 * @throws {ClaudyError} ファイル選択中にエラーが発生した場合
 */
export async function performFileSelection(): Promise<FileSelectionResult[]> {
  try {
    // プロジェクトレベルのファイルを検索
    logger.info(t('common:fileSelection.searchingFiles'));
    const projectFiles = await findClaudeFiles(process.cwd(), true);
    logger.debug(t('common:fileSelection.projectLevelDebug', { mainCount: projectFiles.mainFiles.length, refCount: projectFiles.referencedFiles.length }));
    
    // ユーザーレベルのファイルを検索
    const { files: userFiles, baseDir: userBaseDir } = await findUserClaudeFiles(true);
    logger.debug(t('common:fileSelection.userLevelDebug', { mainCount: userFiles.mainFiles.length, refCount: userFiles.referencedFiles.length }));
    
    // デフォルト選択ロジック：
    // - プロジェクトレベルのファイル（メイン・参照とも）は選択
    // - ユーザーレベルのファイルは選択しない
    const defaultSelection = (_file: string, isUserLevel: boolean, _isReference: boolean): boolean => {
      return !isUserLevel; // プロジェクトレベルのみデフォルトで選択
    };
    
    // 直接チェックボックス付きファイル選択UIを表示
    return await selectFilesWithCheckbox(projectFiles, userFiles, userBaseDir, defaultSelection);
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.FILE_SELECTION_ERROR, 'ファイル選択中にエラーが発生しました');
  }
}