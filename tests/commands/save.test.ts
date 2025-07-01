import { executeSaveCommand } from '../../src/commands/save';
import { ClaudyError } from '../../src/types';
import { ErrorCodes } from '../../src/types/errors';

// モックの設定
jest.mock('../../src/utils/logger');
jest.mock('fs-extra', () => ({
  access: jest.fn(),
  stat: jest.fn(),
  ensureDir: jest.fn(),
  copy: jest.fn(),
}));
jest.mock('../../src/utils/path');
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));
jest.mock('glob');

// モジュールのインポート（モック後に行う）
import { logger } from '../../src/utils/logger';
import * as pathUtils from '../../src/utils/path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { glob } from 'glob';

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockPathUtils = pathUtils as jest.Mocked<typeof pathUtils>;

describe('saveコマンド', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // デフォルトのモック設定
    mockPathUtils.getClaudyDir.mockReturnValue('/home/user/.claudy');
  });

  describe('executeSaveCommand', () => {
    it('セット名が指定されていない場合エラーをスローする', async () => {
      await expect(executeSaveCommand('', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          'セット名が無効です。英数字、ハイフン、アンダースコアのみ使用できます。',
          ErrorCodes.INVALID_SET_NAME,
          { setName: '' }
        )
      );
    });

    it('予約語を使用した場合エラーをスローする', async () => {
      await expect(executeSaveCommand('profiles', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          '"profiles" は予約されているため使用できません',
          ErrorCodes.RESERVED_NAME,
          { setName: 'profiles' }
        )
      );
    });

    it('設定ファイルが存在しない場合エラーをスローする', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      
      (glob as any).mockResolvedValue([]);
      (fs.stat as any).mockRejectedValue(error);

      await expect(executeSaveCommand('test-set', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          '保存対象のファイルが見つかりません。',
          ErrorCodes.NO_FILES_FOUND
        )
      );
    });

    it('既存のセットが存在する場合、確認プロンプトを表示する', async () => {
      (fs.access as any).mockResolvedValue(undefined);
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce([]);
      (fs.stat as any).mockResolvedValue({
        isFile: () => true,
      } as any);
      (inquirer.prompt as any).mockResolvedValue({ overwrite: false });

      await executeSaveCommand('existing-set', { verbose: false });

      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'セット "existing-set" は既に存在します。上書きしますか？',
          default: false,
        },
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith('保存をキャンセルしました');
    });

    it('forceオプションが指定された場合、確認なしで上書きする', async () => {
      (fs.access as any).mockResolvedValue(undefined);
      // globは2回呼ばれる（CLAUDE.mdと.claude/commands/**/*.md）
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce([]);
      (fs.stat as any).mockResolvedValue({
        isFile: () => true,
      } as any);
      (fs.ensureDir as any).mockResolvedValue(undefined);
      (fs.copy as any).mockResolvedValue(undefined);

      await executeSaveCommand('test-set', { verbose: false, force: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith('✓ セット "test-set" に1個のファイルを保存しました');
    });

    it('設定ファイルを正しくコピーする', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.access as any).mockRejectedValue(error);
      
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce(['.claude/commands/test.md']);
      (fs.stat as any).mockResolvedValue({
        isFile: () => true,
      } as any);
      (fs.ensureDir as any).mockResolvedValue(undefined);
      (fs.copy as any).mockResolvedValue(undefined);

      await executeSaveCommand('new-set', { verbose: false });

      expect(fs.ensureDir).toHaveBeenCalledWith('/home/user/.claudy/new-set');
      expect(fs.copy).toHaveBeenCalledTimes(2);
      expect(fs.copy).toHaveBeenCalledWith(
        expect.stringContaining('CLAUDE.md'),
        '/home/user/.claudy/new-set/CLAUDE.md',
        { overwrite: true }
      );
      expect(mockLogger.success).toHaveBeenCalledWith('✓ セット "new-set" に2個のファイルを保存しました');
      expect(mockLogger.info).toHaveBeenCalledWith('保存先: /home/user/.claudy/new-set');
    });

    it('ディレクトリ作成に失敗した場合、適切にエラーハンドリングする', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.access as any).mockRejectedValue(error);
      
      (glob as any).mockResolvedValue(['CLAUDE.md']);
      (fs.stat as any).mockResolvedValue({
        isFile: () => true,
      } as any);
      
      const mkdirError = new Error('Permission denied') as NodeJS.ErrnoException;
      mkdirError.code = 'EACCES';
      (fs.ensureDir as any).mockRejectedValue(mkdirError);

      await expect(executeSaveCommand('test-set', { verbose: false })).rejects.toThrow();
    });

    it('verboseモードで詳細ログを出力する', async () => {
      mockLogger.setVerbose.mockImplementation(() => {});
      
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.access as any).mockRejectedValue(error);
      
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce([]);
      (fs.stat as any).mockResolvedValue({
        isFile: () => true,
      } as any);
      (fs.ensureDir as any).mockResolvedValue(undefined);
      (fs.copy as any).mockResolvedValue(undefined);

      await executeSaveCommand('test-set', { verbose: true });

      expect(mockLogger.setVerbose).toHaveBeenCalledWith(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('保存先: /home/user/.claudy/test-set');
      expect(mockLogger.debug).toHaveBeenCalledWith('見つかったファイル: CLAUDE.md');
    });

    it('空のディレクトリは無視される', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.access as any).mockRejectedValue(error);
      
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce([]);
      (fs.stat as any).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('/')) {
          return Promise.resolve({ isFile: () => false } as any);
        }
        return Promise.resolve({ isFile: () => true } as any);
      });
      (fs.ensureDir as any).mockResolvedValue(undefined);
      (fs.copy as any).mockResolvedValue(undefined);

      await executeSaveCommand('test-set', { verbose: false });

      // ディレクトリはコピーされない
      expect(fs.copy).toHaveBeenCalledTimes(1);
      expect(fs.copy).toHaveBeenCalledWith(
        expect.stringContaining('CLAUDE.md'),
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});