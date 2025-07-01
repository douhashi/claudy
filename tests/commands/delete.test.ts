import { executeDeleteCommand } from '../../src/commands/delete';
import { ClaudyError } from '../../src/types';
import { ErrorCodes } from '../../src/types/errors';

// モックの設定
jest.mock('../../src/utils/logger');
jest.mock('fs-extra', () => ({
  stat: jest.fn(),
  remove: jest.fn(),
}));
jest.mock('../../src/utils/path');
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

// モジュールのインポート（モック後に行う）
import { logger } from '../../src/utils/logger';
import * as pathUtils from '../../src/utils/path';
import fs from 'fs-extra';
import inquirer from 'inquirer';

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockPathUtils = pathUtils as jest.Mocked<typeof pathUtils>;

describe('deleteコマンド', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // デフォルトのモック設定
    mockPathUtils.getClaudyDir.mockReturnValue('/home/user/.claudy');
  });

  describe('executeDeleteCommand', () => {
    it('セット名が指定されていない場合エラーをスローする', async () => {
      await expect(executeDeleteCommand('', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          'セット名が無効です。英数字、ハイフン、アンダースコアのみ使用できます。',
          ErrorCodes.INVALID_SET_NAME,
          { setName: '' }
        )
      );
    });

    it('セットが存在しない場合エラーをスローする', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.stat as any).mockRejectedValue(error);

      await expect(executeDeleteCommand('nonexistent', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          'セット "nonexistent" が見つかりません',
          ErrorCodes.SET_NOT_FOUND,
          { setName: 'nonexistent', path: '/home/user/.claudy/nonexistent' }
        )
      );
    });

    it('確認プロンプトでキャンセルした場合、削除を中止する', async () => {
      (fs.stat as any).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      (inquirer.prompt as any).mockResolvedValue({ confirm: false });

      await executeDeleteCommand('test-set', { verbose: false });

      expect(mockLogger.info).toHaveBeenCalledWith('削除をキャンセルしました');
      expect(fs.remove).not.toHaveBeenCalled();
    });

    it('確認プロンプトで承認した場合、セットを削除する', async () => {
      (fs.stat as any).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      (inquirer.prompt as any).mockResolvedValue({ confirm: true });
      (fs.remove as any).mockResolvedValue(undefined);

      await executeDeleteCommand('test-set', { verbose: false });

      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'セット "test-set" を削除してもよろしいですか？',
          default: false,
        },
      ]);

      expect(fs.remove).toHaveBeenCalledWith('/home/user/.claudy/test-set');
      expect(mockLogger.success).toHaveBeenCalledWith('✓ セット "test-set" を削除しました');
      expect(mockLogger.info).toHaveBeenCalledWith('\n現在のセット一覧を確認するには:');
      expect(mockLogger.info).toHaveBeenCalledWith('  $ claudy list');
    });

    it('forceオプションが指定された場合、確認なしで削除する', async () => {
      (fs.stat as any).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      (fs.remove as any).mockResolvedValue(undefined);

      await executeDeleteCommand('test-set', { verbose: false, force: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(fs.remove).toHaveBeenCalledWith('/home/user/.claudy/test-set');
      expect(mockLogger.success).toHaveBeenCalledWith('✓ セット "test-set" を削除しました');
    });

    it('削除中にエラーが発生した場合、適切にエラーハンドリングする', async () => {
      (fs.stat as any).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      const deleteError = new Error('Permission denied') as NodeJS.ErrnoException;
      deleteError.code = 'EACCES';
      (fs.remove as any).mockRejectedValue(deleteError);

      await expect(
        executeDeleteCommand('test-set', { verbose: false, force: true })
      ).rejects.toThrow();

      expect(fs.remove).toHaveBeenCalledWith('/home/user/.claudy/test-set');
    });

    it('verboseモードで詳細ログを出力する', async () => {
      mockLogger.setVerbose.mockImplementation(() => {});
      
      (fs.stat as any).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      (fs.remove as any).mockResolvedValue(undefined);

      await executeDeleteCommand('test-set', { verbose: true, force: true });

      expect(mockLogger.setVerbose).toHaveBeenCalledWith(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('削除対象セット: test-set');
      expect(mockLogger.debug).toHaveBeenCalledWith('セットパス: /home/user/.claudy/test-set');
    });

    it('セットパスがファイルの場合、存在しないものとして扱う', async () => {
      (fs.stat as any).mockResolvedValue({
        isDirectory: () => false,
      } as any);

      await expect(executeDeleteCommand('file-not-dir', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          'セット "file-not-dir" が見つかりません',
          ErrorCodes.SET_NOT_FOUND,
          { setName: 'file-not-dir', path: '/home/user/.claudy/file-not-dir' }
        )
      );
    });

    it('statでアクセスエラーが発生した場合、適切にラップして再スローする', async () => {
      const accessError = new Error('Access denied') as NodeJS.ErrnoException;
      accessError.code = 'EACCES';
      (fs.stat as any).mockRejectedValue(accessError);

      await expect(executeDeleteCommand('test-set', { verbose: false })).rejects.toThrow();
    });
  });
});