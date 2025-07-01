import { executeLoadCommand } from '../../src/commands/load';
import { ClaudyError } from '../../src/types';
import { ErrorCodes } from '../../src/types/errors';

// モックの設定
jest.mock('../../src/utils/logger');
jest.mock('fs-extra', () => ({
  stat: jest.fn(),
  copy: jest.fn(),
  ensureDir: jest.fn(),
  rename: jest.fn(),
  remove: jest.fn(),
}));
jest.mock('../../src/utils/path');
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));
jest.mock('glob', () => ({
  glob: jest.fn(),
}));

// モジュールのインポート（モック後に行う）
import { logger } from '../../src/utils/logger';
import * as pathUtils from '../../src/utils/path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { glob } from 'glob';

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockPathUtils = pathUtils as jest.Mocked<typeof pathUtils>;

describe('loadコマンド', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // デフォルトのモック設定
    mockPathUtils.getClaudyDir.mockReturnValue('/home/user/.claudy');
    jest.spyOn(process, 'cwd').mockReturnValue('/project');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeLoadCommand', () => {
    it('セット名が指定されていない場合エラーをスローする', async () => {
      await expect(executeLoadCommand('', { verbose: false })).rejects.toThrow(
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

      await expect(executeLoadCommand('nonexistent', { verbose: false })).rejects.toThrow(
        new ClaudyError(
          'セット "nonexistent" が見つかりません',
          ErrorCodes.SET_NOT_FOUND,
          { setName: 'nonexistent', path: '/home/user/.claudy/nonexistent' }
        )
      );
    });

    it('展開するファイルを正しく取得する', async () => {
      // statの動作を詳細に設定
      (fs.stat as any).mockImplementation((path: string) => {
        // セットディレクトリは存在する
        if (path.includes('.claudy/test-set')) {
          return Promise.resolve({ isDirectory: () => true });
        }
        // それ以外のファイルは存在しない（ENOENTエラー）
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce(['.claude/commands/test.md', '.claude/commands/deploy.md']);
      (fs.copy as any).mockResolvedValue(undefined);
      (fs.ensureDir as any).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false });

      expect(glob).toHaveBeenCalledWith('CLAUDE.md', expect.objectContaining({
        cwd: '/home/user/.claudy/test-set'
      }));
      expect(glob).toHaveBeenCalledWith('.claude/**/*.md', expect.objectContaining({
        cwd: '/home/user/.claudy/test-set'
      }));
      expect(fs.copy).toHaveBeenCalledTimes(3);
    });

    it('既存ファイルとの衝突を検出する', async () => {
      (fs.stat as any).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr === '/home/user/.claudy/test-set' || 
            pathStr === '/project/CLAUDE.md' ||
            pathStr.includes('test-set')) {
          return Promise.resolve({ isDirectory: () => pathStr.includes('test-set') } as any);
        }
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce([]);
      (inquirer.prompt as any).mockResolvedValue({ action: 'cancel' });

      await executeLoadCommand('test-set', { verbose: false });

      expect(mockLogger.warn).toHaveBeenCalledWith('以下のファイルが既に存在します:');
      expect(mockLogger.warn).toHaveBeenCalledWith('  - CLAUDE.md');
      expect(mockLogger.info).toHaveBeenCalledWith('展開をキャンセルしました');
    });

    it('forceオプションで既存ファイルを強制上書きする', async () => {
      (fs.stat as any).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr === '/home/user/.claudy/test-set' || 
            pathStr === '/project/CLAUDE.md' ||
            pathStr.includes('test-set')) {
          return Promise.resolve({ isDirectory: () => pathStr.includes('test-set') } as any);
        }
        return Promise.reject(new Error('Not found'));
      });
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce([]);
      (fs.copy as any).mockResolvedValue(undefined);
      (fs.ensureDir as any).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false, force: true });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(fs.copy).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith('✓ セット "test-set" の展開が完了しました');
    });

    it('バックアップオプションを選択した場合、.bakファイルを作成する', async () => {
      (fs.stat as any).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr === '/home/user/.claudy/test-set' || 
            pathStr === '/project/CLAUDE.md' ||
            pathStr.includes('test-set')) {
          return Promise.resolve({ isDirectory: () => pathStr.includes('test-set') } as any);
        }
        return Promise.reject(new Error('Not found'));
      });
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce([]);
      (inquirer.prompt as any).mockResolvedValue({ action: 'backup' });
      (fs.rename as any).mockResolvedValue(undefined);
      (fs.copy as any).mockResolvedValue(undefined);
      (fs.ensureDir as any).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false });

      expect(fs.rename).toHaveBeenCalledWith('/project/CLAUDE.md', '/project/CLAUDE.md.bak');
      expect(fs.copy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('\nバックアップファイル:');
      expect(mockLogger.info).toHaveBeenCalledWith('  - CLAUDE.md.bak');
    });

    it('上書きオプションを選択した場合、バックアップなしで展開する', async () => {
      (fs.stat as any).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr === '/home/user/.claudy/test-set' || 
            pathStr === '/project/CLAUDE.md' ||
            pathStr.includes('test-set')) {
          return Promise.resolve({ isDirectory: () => pathStr.includes('test-set') } as any);
        }
        return Promise.reject(new Error('Not found'));
      });
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce([]);
      (inquirer.prompt as any).mockResolvedValue({ action: 'overwrite' });
      (fs.copy as any).mockResolvedValue(undefined);
      (fs.ensureDir as any).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false });

      expect(fs.rename).not.toHaveBeenCalled();
      expect(fs.copy).toHaveBeenCalled();
    });

    it('展開中にエラーが発生した場合、ロールバックを実行する', async () => {
      (fs.stat as any).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce(['.claude/commands/test.md']);
      (fs.ensureDir as any).mockResolvedValue(undefined);
      
      // 最初のコピーは成功、2つ目で失敗
      (fs.copy as any)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Copy error'));
      
      (fs.remove as any).mockResolvedValue(undefined);

      await expect(executeLoadCommand('test-set', { verbose: false }))
        .rejects.toThrow(new ClaudyError(
          'ファイルの展開に失敗しました。',
          ErrorCodes.EXPAND_FAILED
        ));

      expect(mockLogger.error).toHaveBeenCalledWith('ファイルの展開中にエラーが発生しました');
      expect(mockLogger.info).toHaveBeenCalledWith('ロールバックを実行しています...');
      expect(fs.remove).toHaveBeenCalled();
    });

    it('verboseモードで詳細ログを出力する', async () => {
      mockLogger.setVerbose.mockImplementation(() => {});
      
      (fs.stat as any).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      (glob as any).mockResolvedValueOnce(['CLAUDE.md']).mockResolvedValueOnce([]);
      (fs.copy as any).mockResolvedValue(undefined);
      (fs.ensureDir as any).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: true });

      expect(mockLogger.setVerbose).toHaveBeenCalledWith(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('展開対象ファイル数: 1');
      expect(mockLogger.debug).toHaveBeenCalledWith('展開完了: CLAUDE.md');
    });

    it('ディレクトリ構造を維持して展開する', async () => {
      (fs.stat as any).mockResolvedValue({
        isDirectory: () => true,
      } as any);
      (glob as any).mockResolvedValueOnce([]).mockResolvedValueOnce(['.claude/commands/subdir/deep.md']);
      (fs.copy as any).mockResolvedValue(undefined);
      (fs.ensureDir as any).mockResolvedValue(undefined);

      await executeLoadCommand('test-set', { verbose: false });

      expect(fs.copy).toHaveBeenCalledWith(
        '/home/user/.claudy/test-set/.claude/commands/subdir/deep.md',
        '/project/.claude/commands/subdir/deep.md',
        expect.objectContaining({
          overwrite: true,
          preserveTimestamps: true
        })
      );
    });
  });
});