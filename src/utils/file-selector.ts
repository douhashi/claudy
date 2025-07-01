import path from 'path';
import os from 'os';
import { glob } from 'glob';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { logger } from './logger';
import { ClaudyError } from '../types';
import { ErrorCodes, wrapError } from '../types/errors';

export interface FileSelectionResult {
  files: string[];
  baseDir: string;
}

/**
 * Claude関連ファイルを検索
 * @param baseDir - 検索を開始するディレクトリ
 * @returns 見つかったファイルのパスの配列
 */
export async function findClaudeFiles(baseDir: string): Promise<string[]> {
  const patterns = [
    'CLAUDE.md',
    'CLAUDE.local.md',
    '.claude/**/*.md'
  ];
  
  const files: string[] = [];
  
  for (const pattern of patterns) {
    try {
      const matches = await glob(pattern, {
        cwd: baseDir,
        absolute: false,
        nodir: true,
        dot: true, // .claudeディレクトリを含む
      });
      files.push(...matches);
    } catch (error) {
      logger.debug(`パターン "${pattern}" の検索中にエラー: ${error}`);
    }
  }
  
  return [...new Set(files)].sort(); // 重複を削除してソート
}

/**
 * ユーザーレベルのClaude関連ファイルを検索
 * @returns 見つかったファイルの情報
 */
export async function findUserClaudeFiles(): Promise<{ files: string[], baseDir: string }> {
  const homeDir = os.homedir();
  const userClaudeDir = path.join(homeDir, '.claude');
  const files: string[] = [];
  
  // ~/.claude/CLAUDE.md
  const userClaudeMd = path.join(userClaudeDir, 'CLAUDE.md');
  if (await fs.pathExists(userClaudeMd)) {
    files.push('.claude/CLAUDE.md');
  }
  
  // ~/.claude/commands/**/*.md
  try {
    const commandFiles = await glob('commands/**/*.md', {
      cwd: userClaudeDir,
      absolute: false,
      nodir: true,
    });
    files.push(...commandFiles.map(f => path.join('.claude', f)));
  } catch (error) {
    logger.debug(`ユーザーレベルのコマンドファイル検索中にエラー: ${error}`);
  }
  
  return { files, baseDir: homeDir };
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

/**
 * インタラクティブにファイルを選択
 * @param projectFiles - プロジェクトレベルのファイル
 * @param userFiles - ユーザーレベルのファイル
 * @param userBaseDir - ユーザーレベルの基準ディレクトリ
 * @returns 選択されたファイルの情報
 */
export async function selectFilesInteractively(
  projectFiles: string[],
  userFiles: string[],
  userBaseDir: string
): Promise<FileSelectionResult[]> {
  const choices: FileChoice[] = [];
  const results: FileSelectionResult[] = [];
  
  // プロジェクトレベルのファイル
  if (projectFiles.length > 0) {
    choices.push({
      name: '--- プロジェクトレベル ---',
      value: 'project-header',
      checked: false,
      short: '',
    });
    
    for (const file of projectFiles) {
      choices.push({
        name: formatFilePath(file, process.cwd(), false),
        value: `project:${file}`,
        checked: true,
      });
    }
  }
  
  // ユーザーレベルのファイル
  if (userFiles.length > 0) {
    if (projectFiles.length > 0) {
      choices.push({
        name: '',
        value: 'separator',
        checked: false,
        short: '',
      });
    }
    
    choices.push({
      name: '--- ユーザーレベル ---',
      value: 'user-header',
      checked: false,
      short: '',
    });
    
    for (const file of userFiles) {
      choices.push({
        name: formatFilePath(file, userBaseDir, true),
        value: `user:${file}`,
        checked: true,
      });
    }
  }
  
  if (choices.length === 0) {
    throw new ClaudyError(
      'Claude関連ファイルが見つかりませんでした',
      ErrorCodes.NO_FILES_FOUND,
      { searchDirs: [process.cwd(), userBaseDir] }
    );
  }
  
  const { selectedFiles } = await inquirer.prompt<{ selectedFiles: string[] }>({
    type: 'checkbox',
    name: 'selectedFiles',
    message: '保存するファイルを選択してください (スペースで選択/解除):',
    choices,
    pageSize: 15,
    validate: (input: any): boolean | string => {
      if (!input || input.length === 0) {
        return '少なくとも1つのファイルを選択してください';
      }
      return true;
    },
  });
  
  // 選択されたファイルを分類
  const selectedProjectFiles: string[] = [];
  const selectedUserFiles: string[] = [];
  
  for (const selected of selectedFiles) {
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
  
  return results;
}

/**
 * ファイル選択を実行（エクスポート関数）
 * @returns 選択されたファイルの情報
 */
export async function performFileSelection(): Promise<FileSelectionResult[]> {
  try {
    // プロジェクトレベルのファイルを検索
    logger.info('Claude設定ファイルを検索中...');
    const projectFiles = await findClaudeFiles(process.cwd());
    logger.debug(`プロジェクトレベル: ${projectFiles.length}個のファイルが見つかりました`);
    
    // ユーザーレベルのファイルを検索
    const { files: userFiles, baseDir: userBaseDir } = await findUserClaudeFiles();
    logger.debug(`ユーザーレベル: ${userFiles.length}個のファイルが見つかりました`);
    
    // インタラクティブに選択
    return await selectFilesInteractively(projectFiles, userFiles, userBaseDir);
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.FILE_SELECTION_ERROR, 'ファイル選択中にエラーが発生しました');
  }
}