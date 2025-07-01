import fsExtra from 'fs-extra';
const fs = fsExtra;
import path from 'path';
import { ClaudyError } from '../types/index.js';
import { logger } from './logger.js';

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

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

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