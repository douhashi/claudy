import fsExtra from 'fs-extra';
const fs = fsExtra;
import path from 'path';
import { logger } from './logger.js';

/**
 * 参照ファイル情報
 */
export interface ReferencedFile {
  path: string;
  referredFrom: string[];
}

/**
 * Markdownファイルから@記法で参照されているファイルパスを抽出
 * @param content - Markdownファイルの内容
 * @returns 抽出されたファイルパスの配列
 */
export function extractFileReferences(content: string): string[] {
  // @記法のパターン: @の後に続く非空白文字（括弧内も含む）
  const pattern = /@([^\s\)]+)/g;
  const references: string[] = [];
  
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const referencePath = match[1];
    // 重複を避ける
    if (!references.includes(referencePath)) {
      references.push(referencePath);
    }
  }
  
  logger.debug(`抽出された参照: ${references.join(', ')}`);
  return references;
}

/**
 * 参照パスを解決して絶対パスに変換
 * @param referencePath - 参照パス
 * @param baseDir - 基準ディレクトリ
 * @param sourceFilePath - 参照元ファイルのパス
 * @returns 解決されたパス（存在しない場合はnull）
 */
export async function resolveReferencePath(
  referencePath: string,
  baseDir: string,
  sourceFilePath: string
): Promise<string | null> {
  // 参照元ファイルのディレクトリを基準にする
  const sourceDir = path.dirname(path.join(baseDir, sourceFilePath));
  
  // 絶対パスの場合はそのまま使用
  let resolvedPath: string;
  if (path.isAbsolute(referencePath)) {
    resolvedPath = referencePath;
  } else {
    // 相対パスの場合は参照元ファイルのディレクトリを基準に解決
    resolvedPath = path.resolve(sourceDir, referencePath);
  }
  
  // ファイルの存在確認
  try {
    const exists = await fs.pathExists(resolvedPath);
    if (exists) {
      // baseDirからの相対パスに変換して返す
      const relativePath = path.relative(baseDir, resolvedPath);
      logger.debug(`参照パス解決: ${referencePath} -> ${relativePath}`);
      return relativePath;
    }
  } catch (error) {
    logger.debug(`参照パスの解決に失敗: ${referencePath} - ${error}`);
  }
  
  return null;
}

/**
 * ファイルから参照を再帰的に収集
 * @param filePath - ファイルパス
 * @param baseDir - 基準ディレクトリ
 * @param processedFiles - 処理済みファイルのセット（循環参照防止）
 * @param depth - 現在の深さ
 * @param maxDepth - 最大深さ
 * @returns 参照ファイル情報の配列
 */
export async function collectReferences(
  filePath: string,
  baseDir: string,
  processedFiles: Set<string> = new Set(),
  depth: number = 0,
  maxDepth: number = 2
): Promise<ReferencedFile[]> {
  // 深さ制限チェック
  if (depth >= maxDepth) {
    logger.debug(`深さ制限に達しました: ${filePath} (depth=${depth})`);
    return [];
  }
  
  // 循環参照チェック
  const normalizedPath = path.normalize(filePath);
  if (processedFiles.has(normalizedPath)) {
    logger.debug(`既に処理済みのファイル: ${filePath}`);
    return [];
  }
  
  processedFiles.add(normalizedPath);
  const referencedFiles: ReferencedFile[] = [];
  
  try {
    // ファイルの内容を読み込み
    const fullPath = path.join(baseDir, filePath);
    const content = await fs.readFile(fullPath, 'utf8');
    
    // @記法の参照を抽出
    const references = extractFileReferences(content);
    
    for (const ref of references) {
      // パスを解決
      const resolvedPath = await resolveReferencePath(ref, baseDir, filePath);
      if (resolvedPath) {
        // 既存の参照ファイル情報を検索
        const existing = referencedFiles.find(rf => rf.path === resolvedPath);
        if (existing) {
          // 既存の場合は参照元を追加
          if (!existing.referredFrom.includes(filePath)) {
            existing.referredFrom.push(filePath);
          }
        } else {
          // 新規の場合は追加
          referencedFiles.push({
            path: resolvedPath,
            referredFrom: [filePath]
          });
          
          // 再帰的に参照を収集（Markdownファイルのみ）
          if (resolvedPath.endsWith('.md')) {
            const nestedRefs = await collectReferences(
              resolvedPath,
              baseDir,
              processedFiles,
              depth + 1,
              maxDepth
            );
            
            // ネストされた参照をマージ
            for (const nestedRef of nestedRefs) {
              const existing = referencedFiles.find(rf => rf.path === nestedRef.path);
              if (existing) {
                // 参照元情報をマージ
                for (const from of nestedRef.referredFrom) {
                  if (!existing.referredFrom.includes(from)) {
                    existing.referredFrom.push(from);
                  }
                }
              } else {
                referencedFiles.push(nestedRef);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    logger.debug(`ファイル読み込みエラー: ${filePath} - ${error}`);
  }
  
  return referencedFiles;
}