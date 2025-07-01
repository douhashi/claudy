import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeSaveCommand } from '../../src/commands/save';
import { ClaudyError } from '../../src/types';
import { ErrorCodes } from '../../src/types/errors';

// モックの設定
vi.mock('../../src/utils/logger');
vi.mock('fs-extra', () => ({
  default: {
    access: vi.fn(),
    ensureDir: vi.fn(),
    copy: vi.fn(),
    stat: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('../../src/utils/path');
vi.mock('inquirer');
vi.mock('glob');
vi.mock('../../src/utils/file-selector');

// モジュールのインポート（モック後に行う）
import { logger } from '../../src/utils/logger';
import * as pathUtils from '../../src/utils/path';
import fsExtra from 'fs-extra';
const fs = fsExtra;
import inquirer from 'inquirer';
import { glob } from 'glob';
import { performFileSelection } from '../../src/utils/file-selector';

const mockLogger = vi.mocked(logger);
const mockPathUtils = vi.mocked(pathUtils);
const mockFs = vi.mocked(fsExtra);
const mockInquirer = vi.mocked(inquirer);
const mockGlob = vi.mocked(glob);
const mockPerformFileSelection = vi.mocked(performFileSelection);

describe('saveコマンド', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // デフォルトのモック設定
    mockPathUtils.getClaudyDir.mockReturnValue('/home/user/.config/claudy');
    mockPathUtils.getProjectConfigDir.mockReturnValue('/home/user/.config/claudy/projects/abcdef123456');
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

    it('設定ファイルが存在しない場合エラーをスローする（--allオプション）', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      
      mockGlob.mockResolvedValue([]);
      mockFs.stat.mockRejectedValue(error);

      await expect(executeSaveCommand('test-set', { verbose: false, all: true }))
        .rejects.toThrow('保存対象のファイルが見つかりません。');
    });

    it('インタラクティブモードでファイルが選択されない場合エラーをスローする', async () => {
      mockPerformFileSelection.mockResolvedValue([]);

      await expect(executeSaveCommand('test-set', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          'ファイルが選択されませんでした',
          ErrorCodes.NO_FILES_FOUND
        )
      );
    });

    it('既存のセットが存在する場合、確認プロンプトを表示する（--allオプション）', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockGlob.mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
      } as any);
      mockInquirer.prompt.mockResolvedValue({ overwrite: false });

      await executeSaveCommand('existing-set', { verbose: false, all: true });

      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'セット "existing-set" は既に存在します。上書きしますか？',
          default: false,
        },
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith('保存をキャンセルしました');
    });

    it('forceオプションが指定された場合、確認なしで上書きする（--allオプション）', async () => {
      mockFs.access.mockResolvedValue(undefined);
      // globは2回呼ばれる（CLAUDE.mdと.claude/commands/**/*.md）
      mockGlob.mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
      } as any);
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.copy.mockResolvedValue(undefined);

      await executeSaveCommand('test-set', { verbose: false, force: true, all: true });

      expect(mockInquirer.prompt).not.toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith('✓ 1個のファイルを保存しました');
    });

    it('デフォルトでインタラクティブモードを使用する', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);
      
      mockPerformFileSelection.mockResolvedValue([
        { files: ['CLAUDE.md'], baseDir: process.cwd() }
      ]);
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.copy.mockResolvedValue(undefined);

      await executeSaveCommand('test-set', { verbose: false });

      expect(mockPerformFileSelection).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith('✓ 1個のファイルを保存しました');
    });

    it('設定ファイルを正しくコピーする（--allオプション）', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);
      
      mockGlob.mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        if (pattern === '.claude/commands/**/*.md') return ['.claude/commands/test.md'];
        return [];
      });
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
      } as any);
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.copy.mockResolvedValue(undefined);

      await executeSaveCommand('new-set', { verbose: false, all: true });

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/home/user/.config/claudy/projects/abcdef123456/new-set');
      expect(mockFs.copy).toHaveBeenCalledTimes(2);
      expect(mockFs.copy).toHaveBeenCalledWith(
        expect.stringContaining('CLAUDE.md'),
        '/home/user/.config/claudy/projects/abcdef123456/new-set/CLAUDE.md',
        { overwrite: true }
      );
      expect(mockLogger.success).toHaveBeenCalledWith('✓ 2個のファイルを保存しました');
      expect(mockLogger.info).toHaveBeenCalledWith('保存先: /home/user/.config/claudy/projects/abcdef123456/new-set');
    });

    it('ディレクトリ作成に失敗した場合、適切にエラーハンドリングする（--allオプション）', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);
      
      mockGlob.mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
      } as any);
      
      const mkdirError = new Error('Permission denied') as NodeJS.ErrnoException;
      mkdirError.code = 'EACCES';
      mockFs.ensureDir.mockRejectedValue(mkdirError);

      await expect(executeSaveCommand('test-set', { verbose: false, all: true })).rejects.toThrow();
    });

    it('verboseモードで詳細ログを出力する（--allオプション）', async () => {
      mockLogger.setVerbose.mockImplementation(() => {});
      
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);
      
      mockGlob.mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
      } as any);
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.copy.mockResolvedValue(undefined);

      await executeSaveCommand('test-set', { verbose: true, all: true });

      expect(mockLogger.setVerbose).toHaveBeenCalledWith(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('保存先: /home/user/.config/claudy/projects/abcdef123456/test-set');
      expect(mockLogger.debug).toHaveBeenCalledWith('見つかったファイル: CLAUDE.md');
    });

    it('空のディレクトリは無視される（--allオプション）', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);
      
      mockGlob.mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      mockFs.stat.mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr.endsWith('/')) {
          return Promise.resolve({ isFile: () => false } as any);
        }
        return Promise.resolve({ isFile: () => true } as any);
      });
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.copy.mockResolvedValue(undefined);

      await executeSaveCommand('test-set', { verbose: false, all: true });

      // ディレクトリはコピーされない
      expect(mockFs.copy).toHaveBeenCalledTimes(1);
      expect(mockFs.copy).toHaveBeenCalledWith(
        expect.stringContaining('CLAUDE.md'),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('ファイル数の内訳を表示する（プロジェクトとユーザーレベル両方）', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.access.mockRejectedValue(error);
      
      mockPerformFileSelection.mockResolvedValue([
        { files: ['CLAUDE.md'], baseDir: process.cwd() },
        { files: ['.claude/CLAUDE.md'], baseDir: '/home/user' }
      ]);
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.copy.mockResolvedValue(undefined);

      await executeSaveCommand('test-set', { verbose: false });

      expect(mockLogger.info).toHaveBeenCalledWith('  - プロジェクトレベル: 1個');
      expect(mockLogger.info).toHaveBeenCalledWith('  - ユーザーレベル: 1個');
    });
  });
});