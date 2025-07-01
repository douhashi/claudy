import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeLoadCommand } from '../../src/commands/load';
import { ClaudyError } from '../../src/types';
import { ErrorCodes } from '../../src/types/errors';

// モックの設定
vi.mock('../../src/utils/logger');
vi.mock('../../src/utils/path');
vi.mock('inquirer');
vi.mock('glob');

// fs-extraの個別関数をモック
vi.mock('fs-extra', () => ({
  default: {
    stat: vi.fn(),
    copy: vi.fn(),
    ensureDir: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
  },
  stat: vi.fn(),
  copy: vi.fn(),
  ensureDir: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
}));

// モジュールのインポート（モック後に行う）
import { logger } from '../../src/utils/logger';
import * as pathUtils from '../../src/utils/path';
import fsExtra from 'fs-extra';
const { stat, copy, ensureDir, rename, remove } = fsExtra;
import inquirer from 'inquirer';
import { glob } from 'glob';

const mockLogger = vi.mocked(logger);
const mockPathUtils = vi.mocked(pathUtils);

describe('loadコマンド', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // デフォルトのモック設定
    mockPathUtils.getClaudyDir.mockReturnValue('/home/user/.config/claudy');
    mockPathUtils.getSetDir.mockImplementation((setName) => {
      return `/home/user/.config/claudy/sets/${setName}`;
    });
    mockPathUtils.getHomeDir.mockReturnValue('/home/user');
    mockPathUtils.validateSetName.mockImplementation((name) => {
      if (!name || name.trim() === '') {
        throw new ClaudyError('セット名を指定してください', ErrorCodes.INVALID_SET_NAME);
      }
    });
    vi.spyOn(process, 'cwd').mockReturnValue('/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeLoadCommand', () => {
    it('セット名が指定されていない場合エラーをスローする', async () => {
      await expect(executeLoadCommand('', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          'セット名を指定してください',
          ErrorCodes.INVALID_SET_NAME
        )
      );
    });

    it('セットが存在しない場合エラーをスローする', async () => {
      vi.mocked(stat).mockImplementation((path: any) => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });

      await expect(executeLoadCommand('nonexistent', { verbose: false })).rejects.toMatchObject({
        message: 'セット "nonexistent" が見つかりません',
        code: ErrorCodes.SET_NOT_FOUND,
        details: { setName: 'nonexistent', path: '/home/user/.config/claudy/sets/nonexistent' }
      });
    });

    it('展開するファイルを正しく取得する', async () => {
      // statの動作を詳細に設定
      vi.mocked(stat).mockImplementation((path: any) => {
        const pathStr = path.toString();
        // セットディレクトリは存在する
        if (pathStr.includes('sets/test-set')) {
          return Promise.resolve({ isDirectory: () => true } as any);
        }
        // それ以外のファイルは存在しない（ENOENTエラー）
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });
      vi.mocked(glob).mockImplementation(async (pattern: string, options?: any) => {
        const cwdStr = options?.cwd?.toString() || '';
        if (cwdStr.includes('/project')) {
          if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
          if (pattern === '.claude/**/*.md') return ['.claude/commands/test.md', '.claude/commands/deploy.md'];
        }
        return [];
      });
      vi.mocked(copy).mockResolvedValue(undefined);
      vi.mocked(ensureDir).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false });

      expect(glob).toHaveBeenCalled();
      // projectとuserの2つのスコープでglobが呼ばれる
      expect(copy).toHaveBeenCalledTimes(3);
    });

    it('既存ファイルとの衝突を検出する', async () => {
      vi.mocked(stat).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes('sets/test-set') || 
            pathStr === '/project/CLAUDE.md' ||
            pathStr.includes('test-set')) {
          return Promise.resolve({ isDirectory: () => pathStr.includes('test-set') } as any);
        }
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });
      vi.mocked(glob).mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      vi.mocked(inquirer.prompt).mockResolvedValue({ action: 'cancel' });

      await executeLoadCommand('test-set', { verbose: false });

      expect(mockLogger.warn).toHaveBeenCalledWith('以下のファイルが既に存在します:');
      expect(mockLogger.warn).toHaveBeenCalledWith('  - CLAUDE.md');
      expect(mockLogger.info).toHaveBeenCalledWith('展開をキャンセルしました');
    });

    it('forceオプションで既存ファイルを強制上書きする', async () => {
      vi.mocked(stat).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes('sets/test-set') || 
            pathStr === '/project/CLAUDE.md' ||
            pathStr.includes('test-set')) {
          return Promise.resolve({ isDirectory: () => pathStr.includes('test-set') } as any);
        }
        return Promise.reject(new Error('Not found'));
      });
      vi.mocked(glob).mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      vi.mocked(copy).mockResolvedValue(undefined);
      vi.mocked(ensureDir).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false, force: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(copy).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith('✓ セット "test-set" の展開が完了しました');
    });

    it('バックアップオプションを選択した場合、.bakファイルを作成する', async () => {
      vi.mocked(stat).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes('sets/test-set') || 
            pathStr === '/project/CLAUDE.md' ||
            pathStr.includes('test-set')) {
          return Promise.resolve({ isDirectory: () => pathStr.includes('test-set') } as any);
        }
        return Promise.reject(new Error('Not found'));
      });
      vi.mocked(glob).mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      vi.mocked(inquirer.prompt).mockResolvedValue({ action: 'backup' });
      vi.mocked(rename).mockResolvedValue(undefined);
      vi.mocked(copy).mockResolvedValue(undefined);
      vi.mocked(ensureDir).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false });

      expect(rename).toHaveBeenCalledWith('/project/CLAUDE.md', '/project/CLAUDE.md.bak');
      expect(copy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('\nバックアップファイル:');
      expect(mockLogger.info).toHaveBeenCalledWith('  - CLAUDE.md.bak');
    });

    it('上書きオプションを選択した場合、バックアップなしで展開する', async () => {
      vi.mocked(stat).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes('sets/test-set') || 
            pathStr === '/project/CLAUDE.md' ||
            pathStr.includes('test-set')) {
          return Promise.resolve({ isDirectory: () => pathStr.includes('test-set') } as any);
        }
        return Promise.reject(new Error('Not found'));
      });
      vi.mocked(glob).mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      vi.mocked(inquirer.prompt).mockResolvedValue({ action: 'overwrite' });
      vi.mocked(copy).mockResolvedValue(undefined);
      vi.mocked(ensureDir).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false });

      expect(rename).not.toHaveBeenCalled();
      expect(copy).toHaveBeenCalled();
    });

    it('展開中にエラーが発生した場合、ロールバックを実行する', async () => {
      vi.mocked(stat).mockImplementation((path: any) => {
        const pathStr = path.toString();
        // セットディレクトリは存在する
        if (pathStr.includes('sets/test-set')) {
          return Promise.resolve({ isDirectory: () => true } as any);
        }
        // 現在のディレクトリのファイルは存在しない
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });
      vi.mocked(glob).mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        if (pattern === '.claude/**/*.md') return ['.claude/commands/test.md'];
        return [];
      });
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      
      // 最初のコピーは成功、2つ目で失敗
      vi.mocked(copy)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Copy error'));
      
      vi.mocked(remove).mockResolvedValue(undefined);

      await expect(executeLoadCommand('test-set', { verbose: false }))
        .rejects.toThrow('ファイルの展開に失敗しました。');

      expect(mockLogger.error).toHaveBeenCalledWith('ファイルの展開中にエラーが発生しました');
      expect(mockLogger.info).toHaveBeenCalledWith('ロールバックを実行しています...');
      expect(remove).toHaveBeenCalled();
    });

    it('verboseモードで詳細ログを出力する', async () => {
      mockLogger.setVerbose.mockImplementation(() => {});
      
      vi.mocked(stat).mockImplementation((path: any) => {
        const pathStr = path.toString();
        // セットディレクトリは存在する
        if (pathStr.includes('sets/test-set')) {
          return Promise.resolve({ isDirectory: () => true } as any);
        }
        // 現在のディレクトリのファイルは存在しない
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });
      vi.mocked(glob).mockImplementation(async (pattern: string, options?: any) => {
        const cwdStr = options?.cwd?.toString() || '';
        if (cwdStr.includes('/project')) {
          if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        }
        return [];
      });
      vi.mocked(copy).mockResolvedValue(undefined);
      vi.mocked(ensureDir).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: true });

      expect(mockLogger.setVerbose).toHaveBeenCalledWith(true);
      expect(mockLogger.debug).toHaveBeenCalled();
      // デバッグログの内容を確認
      const debugCalls = mockLogger.debug.mock.calls;
      expect(debugCalls.some(call => call[0].includes('展開対象ファイル数'))).toBe(true);
      expect(debugCalls.some(call => call[0].includes('展開完了: CLAUDE.md'))).toBe(true);
    });

    it('ディレクトリ構造を維持して展開する', async () => {
      vi.mocked(stat).mockImplementation((path: any) => {
        const pathStr = path.toString();
        // セットディレクトリは存在する
        if (pathStr.includes('sets/test-set')) {
          return Promise.resolve({ isDirectory: () => true } as any);
        }
        // 現在のディレクトリのファイルは存在しない
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });
      vi.mocked(glob).mockImplementation(async (pattern: string, options?: any) => {
        if (pattern === '.claude/**/*.md') return ['.claude/commands/subdir/deep.md'];
        return [];
      });
      vi.mocked(copy).mockResolvedValue(undefined);
      vi.mocked(ensureDir).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false });

      expect(copy).toHaveBeenCalledWith(
        expect.stringContaining('/home/user/.config/claudy/sets/test-set'),
        '/project/.claude/commands/subdir/deep.md',
        expect.objectContaining({
          overwrite: true,
          preserveTimestamps: true
        })
      );
    });
  });
});