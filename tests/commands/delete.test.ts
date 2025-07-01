import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeDeleteCommand } from '../../src/commands/delete';
import { ClaudyError } from '../../src/types';
import { ErrorCodes } from '../../src/types/errors';

// モックの設定
vi.mock('../../src/utils/logger');
vi.mock('fs-extra', () => ({
  default: {
    stat: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('../../src/utils/path');
vi.mock('inquirer');

// モジュールのインポート（モック後に行う）
import { logger } from '../../src/utils/logger';
import * as pathUtils from '../../src/utils/path';
import fsExtra from 'fs-extra';
const fs = fsExtra;
import inquirer from 'inquirer';

const mockLogger = vi.mocked(logger);
const mockPathUtils = vi.mocked(pathUtils);
const mockFs = vi.mocked(fsExtra);
const mockInquirer = vi.mocked(inquirer);

describe('deleteコマンド', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // デフォルトのモック設定
    mockPathUtils.getClaudyDir.mockReturnValue('/home/user/.config/claudy');
    mockPathUtils.getSetsDir.mockReturnValue('/home/user/.config/claudy/sets');
    mockPathUtils.getSetDir.mockReturnValue('/home/user/.config/claudy/sets/test-set');
    mockPathUtils.validateSetName.mockImplementation((name) => {
      if (!name || name.trim() === '') {
        throw new ClaudyError('セット名を指定してください', ErrorCodes.INVALID_SET_NAME);
      }
    });
  });

  describe('executeDeleteCommand', () => {
    it('セット名が指定されていない場合エラーをスローする', async () => {
      mockPathUtils.validateSetName.mockImplementation(() => {
        throw new ClaudyError('セット名を指定してください', ErrorCodes.INVALID_SET_NAME);
      });

      await expect(executeDeleteCommand('', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          'セット名を指定してください',
          ErrorCodes.INVALID_SET_NAME
        )
      );
    });

    it('セットが存在しない場合エラーをスローする', async () => {
      mockPathUtils.getSetDir.mockReturnValue('/home/user/.config/claudy/sets/nonexistent');
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.stat.mockRejectedValue(error);

      await expect(executeDeleteCommand('nonexistent', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          'セット "nonexistent" が見つかりません',
          ErrorCodes.SET_NOT_FOUND,
          { setName: 'nonexistent', path: '/home/user/.config/claudy/sets/nonexistent' }
        )
      );
    });

    it('確認プロンプトでキャンセルした場合、削除を中止する', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);

      mockInquirer.prompt.mockResolvedValue({ confirm: false });

      await executeDeleteCommand('test-set', { verbose: false });

      expect(mockLogger.info).toHaveBeenCalledWith('削除をキャンセルしました');
      expect(mockFs.remove).not.toHaveBeenCalled();
    });

    it('確認プロンプトで承認した場合、セットを削除する', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);

      mockInquirer.prompt.mockResolvedValue({ confirm: true });
      mockFs.remove.mockResolvedValue(undefined);

      await executeDeleteCommand('test-set', { verbose: false });

      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'セット "test-set" を削除してもよろしいですか？',
          default: false,
        },
      ]);

      expect(mockFs.remove).toHaveBeenCalledWith('/home/user/.config/claudy/sets/test-set');
      expect(mockLogger.success).toHaveBeenCalledWith('✓ セット "test-set" を削除しました');
      expect(mockLogger.info).toHaveBeenCalledWith('\n現在のセット一覧を確認するには:');
      expect(mockLogger.info).toHaveBeenCalledWith('  $ claudy list');
    });

    it('forceオプションが指定された場合、確認なしで削除する', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);

      mockFs.remove.mockResolvedValue(undefined);

      await executeDeleteCommand('test-set', { verbose: false, force: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(mockFs.remove).toHaveBeenCalledWith('/home/user/.config/claudy/sets/test-set');
      expect(mockLogger.success).toHaveBeenCalledWith('✓ セット "test-set" を削除しました');
    });

    it('削除中にエラーが発生した場合、適切にエラーハンドリングする', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);

      const deleteError = new Error('Permission denied') as NodeJS.ErrnoException;
      deleteError.code = 'EACCES';
      mockFs.remove.mockRejectedValue(deleteError);

      await expect(
        executeDeleteCommand('test-set', { verbose: false, force: true })
      ).rejects.toThrow();

      expect(mockFs.remove).toHaveBeenCalledWith('/home/user/.config/claudy/sets/test-set');
    });

    it('verboseモードで詳細ログを出力する', async () => {
      mockLogger.setVerbose.mockImplementation(() => {});
      
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);

      mockFs.remove.mockResolvedValue(undefined);

      await executeDeleteCommand('test-set', { verbose: true, force: true });

      expect(mockLogger.setVerbose).toHaveBeenCalledWith(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('削除対象セット: test-set');
      expect(mockLogger.debug).toHaveBeenCalledWith('セットパス: /home/user/.config/claudy/sets/test-set');
    });

    it('セットパスがファイルの場合、存在しないものとして扱う', async () => {
      mockPathUtils.getSetDir.mockReturnValue('/home/user/.config/claudy/sets/file-not-dir');
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
      } as any);

      await expect(executeDeleteCommand('file-not-dir', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          'セット "file-not-dir" が見つかりません',
          ErrorCodes.SET_NOT_FOUND,
          { setName: 'file-not-dir', path: '/home/user/.config/claudy/sets/file-not-dir' }
        )
      );
    });

    it('statでアクセスエラーが発生した場合、適切にラップして再スローする', async () => {
      const accessError = new Error('Access denied') as NodeJS.ErrnoException;
      accessError.code = 'EACCES';
      mockFs.stat.mockRejectedValue(accessError);

      await expect(executeDeleteCommand('test-set', { verbose: false })).rejects.toThrow();
    });
  });
});