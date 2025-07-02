import fsExtra from 'fs-extra';
const fs = fsExtra;
import path from 'path';
import { ClaudyError } from '../types/index.js';
import { logger } from './logger.js';

/**
 * ディレクトリを確保（存在しない場合は作成）
 * @param dirPath - ディレクトリパス
 * @throws {ClaudyError} ディレクトリの作成に失敗した場合
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.ensureDir(dirPath);
    logger.debug(`ディレクトリを確保しました: ${dirPath}`);
  } catch (error) {
    throw new ClaudyError(
      `ディレクトリの作成に失敗しました: ${dirPath}`,
      'DIR_CREATE_ERROR',
      error,
    );
  }
}

/**
 * ファイルの存在を確認
 * @param filePath - ファイルパス
 * @returns 存在する場合true
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * ファイルを読み込み
 * @param filePath - ファイルパス
 * @returns ファイルの内容
 * @throws {ClaudyError} ファイルの読み込みに失敗した場合
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    logger.debug(`ファイルを読み込みました: ${filePath}`);
    return content;
  } catch (error) {
    throw new ClaudyError(
      `ファイルの読み込みに失敗しました: ${filePath}`,
      'FILE_READ_ERROR',
      error,
    );
  }
}

/**
 * ファイルを書き込み
 * @param filePath - ファイルパス
 * @param content - 書き込む内容
 * @throws {ClaudyError} ファイルの書き込みに失敗した場合
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
    logger.debug(`ファイルを書き込みました: ${filePath}`);
  } catch (error) {
    throw new ClaudyError(
      `ファイルの書き込みに失敗しました: ${filePath}`,
      'FILE_WRITE_ERROR',
      error,
    );
  }
}

/**
 * ファイルをコピー
 * @param src - コピー元ファイルパス
 * @param dest - コピー先ファイルパス
 * @throws {ClaudyError} ファイルのコピーに失敗した場合
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  try {
    await fs.ensureDir(path.dirname(dest));
    await fs.copy(src, dest);
    logger.debug(`ファイルをコピーしました: ${src} → ${dest}`);
  } catch (error) {
    throw new ClaudyError(
      `ファイルのコピーに失敗しました: ${src} → ${dest}`,
      'FILE_COPY_ERROR',
      error,
    );
  }
}

/**
 * ファイルを削除
 * @param filePath - 削除するファイルパス
 * @throws {ClaudyError} ファイルの削除に失敗した場合
 */
export async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.remove(filePath);
    logger.debug(`ファイルを削除しました: ${filePath}`);
  } catch (error) {
    throw new ClaudyError(
      `ファイルの削除に失敗しました: ${filePath}`,
      'FILE_DELETE_ERROR',
      error,
    );
  }
}

/**
 * JSONファイルを読み込み
 * @param filePath - JSONファイルパス
 * @returns パースされたデータ
 * @throws {ClaudyError} ファイルの読み込みまたはJSON解析に失敗した場合
 */
export async function readJson<T = unknown>(filePath: string): Promise<T> {
  try {
    const content = await readFile(filePath);
    return JSON.parse(content) as T;
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw new ClaudyError(
      `JSONファイルの解析に失敗しました: ${filePath}`,
      'JSON_PARSE_ERROR',
      error,
    );
  }
}

/**
 * JSONファイルを書き込み
 * @param filePath - JSONファイルパス
 * @param data - 書き込むデータ
 * @throws {ClaudyError} ファイルの書き込みまたはJSONシリアライズに失敗した場合
 */
export async function writeJson<T = unknown>(filePath: string, data: T): Promise<void> {
  try {
    const content = JSON.stringify(data, null, 2);
    await writeFile(filePath, content);
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw new ClaudyError(
      `JSONファイルの書き込みに失敗しました: ${filePath}`,
      'JSON_WRITE_ERROR',
      error,
    );
  }
}

/**
 * ファイルまたはディレクトリをコピー
 * @param src - コピー元パス
 * @param dest - コピー先パス
 * @throws {ClaudyError} コピーに失敗した場合
 */
export async function copyFileOrDir(src: string, dest: string): Promise<void> {
  try {
    await fs.ensureDir(path.dirname(dest));
    await fs.copy(src, dest, { overwrite: false });
    logger.debug(`ディレクトリをコピーしました: ${src} → ${dest}`);
  } catch (error) {
    throw new ClaudyError(
      `ディレクトリのコピーに失敗しました: ${src} → ${dest}`,
      'DIR_COPY_ERROR',
      error,
    );
  }
}