import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { executeLoadCommand } from '../../src/commands/load';
import { ClaudyError } from '../../src/types';
import { ErrorCodes } from '../../src/types/errors';
import { setupI18n, i18nAssert } from '../helpers/i18n-test-helper';

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
    mockPathUtils.getHomeDir.mockReturnValue('/home/user');
    mockPathUtils.validateSetName.mockImplementation((name) => {
      if (!name || name.trim() === '') {
        throw new ClaudyError('Invalid set name', ErrorCodes.INVALID_SET_NAME);
      }
    });
    vi.spyOn(process, 'cwd').mockReturnValue('/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeLoadCommand', () => {
    it('セット名が指定されていない場合エラーをスローする', async () => {
      try {
        await executeLoadCommand('', { verbose: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        i18nAssert.errorMatches(error, ErrorCodes.INVALID_SET_NAME);
      }
    });

    it('セットが存在しない場合エラーをスローする', async () => {
      vi.mocked(stat).mockImplementation((path: any) => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });

      try {
        await executeLoadCommand('nonexistent', { verbose: false });
        expect.fail('Should have thrown an error');
      } catch (error) {
        i18nAssert.errorMatches(error, ErrorCodes.SET_NOT_FOUND, { setName: 'nonexistent' });
      }
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
        if (pattern === '**/*' && cwdStr.includes('/project')) {
          return ['CLAUDE.md', '.claude/commands/test.md', '.claude/commands/deploy.md'];
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
        if (pattern === '**/*') return ['CLAUDE.md'];
        return [];
      });
      vi.mocked(inquirer.prompt).mockResolvedValue({ action: 'cancel' });

      await executeLoadCommand('test-set', { verbose: false });

      // Check that warning about existing files was shown
      i18nAssert.calledWithPhrase(mockLogger.warn, 'exist');
      i18nAssert.calledWithPhrase(mockLogger.warn, 'CLAUDE.md');
      // Check that cancellation message was shown
      i18nAssert.calledWithPhrase(mockLogger.info, 'cancel');
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
        if (pattern === '**/*') return ['CLAUDE.md'];
        return [];
      });
      vi.mocked(copy).mockResolvedValue(undefined);
      vi.mocked(ensureDir).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false, force: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(copy).toHaveBeenCalled();
      // Check that success message contains the set name
      i18nAssert.calledWithPhrase(mockLogger.success, 'test-set');
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
        if (pattern === '**/*') return ['CLAUDE.md'];
        return [];
      });
      vi.mocked(inquirer.prompt).mockResolvedValue({ action: 'backup' });
      vi.mocked(rename).mockResolvedValue(undefined);
      vi.mocked(copy).mockResolvedValue(undefined);
      vi.mocked(ensureDir).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false });

      expect(rename).toHaveBeenCalledWith('/project/CLAUDE.md', '/project/CLAUDE.md.bak');
      expect(copy).toHaveBeenCalled();
      // Check that backup files message was shown
      i18nAssert.calledWithPhrase(mockLogger.info, 'backup');
      i18nAssert.calledWithPhrase(mockLogger.info, 'CLAUDE.md.bak');
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
        if (pattern === '**/*') return ['CLAUDE.md'];
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
        if (pattern === '**/*') return ['CLAUDE.md'];
        if (pattern === '**/*') return ['.claude/commands/test.md'];
        return [];
      });
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      
      // 最初のコピーは成功、2つ目で失敗
      vi.mocked(copy)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Copy error'));
      
      vi.mocked(remove).mockResolvedValue(undefined);

      await expect(executeLoadCommand('test-set', { verbose: false }))
        .rejects.toThrow();

      // Check that error and rollback messages were shown
      expect(mockLogger.error).toHaveBeenCalled();
      i18nAssert.calledWithPhrase(mockLogger.info, 'rollback');
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
          if (pattern === '**/*') return ['CLAUDE.md'];
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
      expect(debugCalls.some(call => typeof call[0] === 'string' && call[0].includes('1'))).toBe(true);
      expect(debugCalls.some(call => typeof call[0] === 'string' && call[0].includes('CLAUDE.md'))).toBe(true);
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
        if (pattern === '**/*') return ['.claude/commands/subdir/deep.md'];
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

    it('参照ファイルを含むすべてのファイルを復元する', async () => {
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
      
      // glob が '**/*' パターンですべてのファイルを返すようにモック
      vi.mocked(glob).mockImplementation(async (pattern: string, options?: any) => {
        const cwdStr = options?.cwd?.toString() || '';
        if (pattern === '**/*' && cwdStr.includes('/project')) {
          return [
            'CLAUDE.md',
            '.claude/commands/test.md',
            'docs/api-reference.md',  // 参照ファイル
            'src/utils/helper.ts'     // 参照ファイル
          ];
        }
        return [];
      });
      
      vi.mocked(copy).mockResolvedValue(undefined);
      vi.mocked(ensureDir).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false });

      // すべてのファイルがコピーされたことを確認
      expect(copy).toHaveBeenCalledTimes(4);
      
      // 参照ファイルも含めてコピーされていることを確認
      expect(copy).toHaveBeenCalledWith(
        expect.stringContaining('docs/api-reference.md'),
        '/project/docs/api-reference.md',
        expect.objectContaining({
          overwrite: true,
          preserveTimestamps: true
        })
      );
      
      expect(copy).toHaveBeenCalledWith(
        expect.stringContaining('src/utils/helper.ts'),
        '/project/src/utils/helper.ts',
        expect.objectContaining({
          overwrite: true,
          preserveTimestamps: true
        })
      );
    });
  });
});