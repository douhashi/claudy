import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { setupI18n, i18nAssert } from '../helpers/i18n-test-helper';
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
  beforeAll(async () => {
    await setupI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // デフォルトのモック設定
    mockPathUtils.getClaudyDir.mockReturnValue('/home/user/.config/claudy');
    mockPathUtils.getSetsDir.mockReturnValue('/home/user/.config/claudy/sets');
    mockPathUtils.getSetDir.mockReturnValue('/home/user/.config/claudy/sets/test-set');
    mockPathUtils.validateSetName.mockImplementation((name) => {
      if (!name || name.trim() === '') {
        throw new ClaudyError('Invalid set name', ErrorCodes.INVALID_SET_NAME);
      }
    });
  });

  describe('executeDeleteCommand', () => {
    it('セット名が指定されていない場合エラーをスローする', async () => {
      mockPathUtils.validateSetName.mockImplementation(() => {
        throw new ClaudyError('Invalid set name', ErrorCodes.INVALID_SET_NAME);
      });

      try {
        await executeDeleteCommand('', { verbose: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        i18nAssert.errorMatches(error, ErrorCodes.INVALID_SET_NAME);
      }
    });

    it('セットが存在しない場合エラーをスローする', async () => {
      mockPathUtils.getSetDir.mockReturnValue('/home/user/.config/claudy/sets/nonexistent');
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.stat.mockRejectedValue(error);

      try {
        await executeDeleteCommand('nonexistent', { verbose: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        i18nAssert.errorMatches(error, ErrorCodes.SET_NOT_FOUND, { setName: 'nonexistent' });
      }
    });

    it('確認プロンプトでキャンセルした場合、削除を中止する', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);

      mockInquirer.prompt.mockResolvedValue({ confirm: false });

      await executeDeleteCommand('test-set', { verbose: false });

      // Check that cancellation message was shown
      i18nAssert.calledWithPhrase(mockLogger.info, 'cancel');
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
          message: expect.stringContaining('test-set'),
          default: false,
        },
      ]);

      expect(mockFs.remove).toHaveBeenCalledWith('/home/user/.config/claudy/sets/test-set');
      // Check that success message contains the set name
      i18nAssert.calledWithPhrase(mockLogger.success, 'test-set');
      // Check that hint about list command was shown
      i18nAssert.calledWithPhrase(mockLogger.info, 'list');
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
      // Check that success message contains the set name
      i18nAssert.calledWithPhrase(mockLogger.success, 'test-set');
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
      // Check that debug messages contain expected information
      i18nAssert.calledWithPhrase(mockLogger.debug, 'test-set');
      i18nAssert.calledWithPhrase(mockLogger.debug, '/home/user/.config/claudy/sets/test-set');
    });

    it('セットパスがファイルの場合、存在しないものとして扱う', async () => {
      mockPathUtils.getSetDir.mockReturnValue('/home/user/.config/claudy/sets/file-not-dir');
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
      } as any);

      try {
        await executeDeleteCommand('file-not-dir', { verbose: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        i18nAssert.errorMatches(error, ErrorCodes.SET_NOT_FOUND, { setName: 'file-not-dir' });
      }
    });

    it('statでアクセスエラーが発生した場合、適切にラップして再スローする', async () => {
      const accessError = new Error('Access denied') as NodeJS.ErrnoException;
      accessError.code = 'EACCES';
      mockFs.stat.mockRejectedValue(accessError);

      await expect(executeDeleteCommand('test-set', { verbose: false })).rejects.toThrow();
    });
  });
});