import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { setupI18n, i18nAssert } from '../helpers/i18n-test-helper';
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
  beforeAll(async () => {
    await setupI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // デフォルトのモック設定
    mockPathUtils.getClaudyDir.mockReturnValue('/home/user/.config/claudy');
    mockPathUtils.getSetDir.mockImplementation((setName) => {
      return `/home/user/.config/claudy/sets/${setName}`;
    });
    mockPathUtils.validateSetName.mockImplementation((name) => {
      if (!name || name.trim() === '') {
        throw new ClaudyError('セット名を指定してください', ErrorCodes.INVALID_SET_NAME);
      }
      if (name === 'profiles') {
        throw new ClaudyError('"profiles"は予約語のため使用できません', ErrorCodes.INVALID_SET_NAME, { setName: name });
      }
    });
  });

  describe('executeSaveCommand', () => {
    it('セット名が指定されていない場合エラーをスローする', async () => {
      try {
        await executeSaveCommand('', { verbose: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        i18nAssert.errorMatches(error, ErrorCodes.INVALID_SET_NAME);
      }
    });

    it('予約語を使用した場合エラーをスローする', async () => {
      try {
        await executeSaveCommand('profiles', { verbose: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        i18nAssert.errorMatches(error, ErrorCodes.INVALID_SET_NAME, { setName: 'profiles' });
      }
    });

    it('設定ファイルが存在しない場合エラーをスローする（--allオプション）', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      
      mockGlob.mockResolvedValue([]);
      mockFs.stat.mockRejectedValue(error);

      await expect(executeSaveCommand('test-set', { verbose: false, all: true }))
        .rejects.toThrow();
    });

    it('インタラクティブモードでファイルが選択されない場合エラーをスローする', async () => {
      mockPerformFileSelection.mockResolvedValue([]);

      try {
        await executeSaveCommand('test-set', { verbose: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        i18nAssert.errorMatches(error, ErrorCodes.NO_FILES_FOUND);
      }
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
          message: expect.stringContaining('existing-set'),
          default: false,
        },
      ]);
      // Check that cancellation message was shown
      i18nAssert.calledWithPhrase(mockLogger.info, 'cancel');
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
      // Check that success message shows 1 file saved
      i18nAssert.calledWithPhrase(mockLogger.success, '1');
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
      // Check that success message shows 1 file saved
      i18nAssert.calledWithPhrase(mockLogger.success, '1');
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

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/home/user/.config/claudy/sets/new-set/project');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/home/user/.config/claudy/sets/new-set/project/.claude/commands');
      expect(mockFs.copy).toHaveBeenCalledTimes(2);
      expect(mockFs.copy).toHaveBeenCalledWith(
        expect.stringContaining('CLAUDE.md'),
        '/home/user/.config/claudy/sets/new-set/project/CLAUDE.md',
        { overwrite: true }
      );
      // Check that success message shows 2 files saved
      i18nAssert.calledWithPhrase(mockLogger.success, '2');
      // Check that save path is shown
      i18nAssert.calledWithPhrase(mockLogger.info, '/home/user/.config/claudy/sets/new-set');
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
      // Check that debug messages contain expected information
      i18nAssert.calledWithPhrase(mockLogger.debug, '/home/user/.config/claudy/sets/test-set');
      i18nAssert.calledWithPhrase(mockLogger.debug, 'CLAUDE.md');
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

      // Check that level breakdown is shown
      const infoCalls = mockLogger.info.mock.calls.map(call => call[0]);
      expect(infoCalls.some(msg => msg.includes('Project') && msg.includes('1'))).toBe(true);
      expect(infoCalls.some(msg => msg.includes('User') && msg.includes('1'))).toBe(true);
    });

    it('既存のセットが存在する場合、確認後にディレクトリを削除する（--allオプション）', async () => {
      // 既存のセットが存在する
      mockFs.access.mockResolvedValue(undefined);
      mockGlob.mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
      } as any);
      mockInquirer.prompt.mockResolvedValue({ overwrite: true });
      mockFs.remove.mockResolvedValue(undefined);
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.copy.mockResolvedValue(undefined);

      await executeSaveCommand('existing-set', { verbose: false, all: true });

      // ディレクトリが削除されることを確認
      expect(mockFs.remove).toHaveBeenCalledWith('/home/user/.config/claudy/sets/existing-set');
      // その後にファイルがコピーされることを確認
      expect(mockFs.copy).toHaveBeenCalled();
      // 成功メッセージが表示されることを確認
      i18nAssert.calledWithPhrase(mockLogger.success, '1');
    });

    it('--forceオプションが指定された場合、確認なしでディレクトリを削除する（--allオプション）', async () => {
      // 既存のセットが存在する
      mockFs.access.mockResolvedValue(undefined);
      mockGlob.mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
      } as any);
      mockFs.remove.mockResolvedValue(undefined);
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.copy.mockResolvedValue(undefined);

      await executeSaveCommand('existing-set', { verbose: false, force: true, all: true });

      // 確認プロンプトが表示されないことを確認
      expect(mockInquirer.prompt).not.toHaveBeenCalled();
      // ディレクトリが削除されることを確認
      expect(mockFs.remove).toHaveBeenCalledWith('/home/user/.config/claudy/sets/existing-set');
      // その後にファイルがコピーされることを確認
      expect(mockFs.copy).toHaveBeenCalled();
    });

    it('ディレクトリ削除に失敗した場合、エラーをスローしてファイルコピーを実行しない', async () => {
      // 既存のセットが存在する
      mockFs.access.mockResolvedValue(undefined);
      mockGlob.mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
      } as any);
      mockInquirer.prompt.mockResolvedValue({ overwrite: true });
      
      // ディレクトリ削除でエラーを発生させる
      const removeError = new Error('Permission denied') as NodeJS.ErrnoException;
      removeError.code = 'EACCES';
      mockFs.remove.mockRejectedValue(removeError);

      // エラーがスローされることを確認
      await expect(executeSaveCommand('existing-set', { verbose: false, all: true }))
        .rejects.toThrow();

      // ディレクトリ削除が呼ばれたことを確認
      expect(mockFs.remove).toHaveBeenCalledWith('/home/user/.config/claudy/sets/existing-set');
      // ファイルコピーが呼ばれていないことを確認
      expect(mockFs.copy).not.toHaveBeenCalled();
    });

    it('新規セットの場合、ディレクトリ削除を行わない', async () => {
      // 新規セット（存在しない）
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

      await executeSaveCommand('new-set', { verbose: false, all: true });

      // ディレクトリ削除が呼ばれていないことを確認
      expect(mockFs.remove).not.toHaveBeenCalled();
      // ファイルコピーが呼ばれることを確認
      expect(mockFs.copy).toHaveBeenCalled();
    });
  });
});