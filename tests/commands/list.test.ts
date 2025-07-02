import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeListCommand } from '../../src/commands/list';

// モックの設定
vi.mock('../../src/utils/logger');
vi.mock('fs-extra', () => ({
  default: {
    access: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    pathExists: vi.fn(),
  },
}));
vi.mock('../../src/utils/path');

// モジュールのインポート（モック後に行う）
import { logger } from '../../src/utils/logger';
import * as pathUtils from '../../src/utils/path';
import fsExtra from 'fs-extra';
const fs = fsExtra;

const mockLogger = vi.mocked(logger);
const mockPathUtils = vi.mocked(pathUtils);

// console.logのモック
const originalConsoleLog = console.log;
let consoleOutput: string[] = [];

describe('listコマンド', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutput = [];
    console.log = vi.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
    
    // デフォルトのモック設定
    mockPathUtils.getClaudyDir.mockReturnValue('/home/user/.config/claudy');
    mockPathUtils.getSetsDir.mockReturnValue('/home/user/.config/claudy/sets');
    // getProjectConfigDirは新しい構造では使用しないが、互換性のためモックを設定
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('executeListCommand', () => {
    it('保存されたセットがない場合、適切なメッセージを表示する', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      await executeListCommand({ verbose: false });

      expect(mockLogger.info).toHaveBeenCalledWith('保存されたセットを検索中...');
      expect(mockLogger.info).toHaveBeenCalledWith('保存されたセットはありません');
    });

    it('保存されたセットを正しく一覧表示する', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      
      // pathExistsのモック
      vi.mocked(fs.pathExists).mockImplementation((path: any) => {
        const pathStr = path.toString();
        // projectまたはuserディレクトリのみ存在
        if (pathStr.includes('/project') || pathStr.includes('/user')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });
      
      // readdirのモック
      vi.mocked(fs.readdir).mockImplementation((dirPath: any, options?: any) => {
        const pathStr = dirPath.toString();
        
        if (options?.withFileTypes) {
          if (pathStr === '/home/user/.config/claudy/sets') {
            return Promise.resolve([
              { name: 'backend', isDirectory: () => true, isFile: () => false },
              { name: 'frontend', isDirectory: () => true, isFile: () => false },
            ] as any);
          }
          // projectディレクトリ内
          if (pathStr.includes('backend/project') || pathStr.includes('frontend/project')) {
            return Promise.resolve([
              { name: 'CLAUDE.md', isDirectory: () => false, isFile: () => true },
            ] as any);
          }
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      
      // statのモック
      vi.mocked(fs.stat).mockImplementation(() => {
        return Promise.resolve({
          isDirectory: () => true,
          birthtime: new Date('2024-01-01'),
        } as any);
      });

      await executeListCommand({ verbose: false });

      expect(mockLogger.info).toHaveBeenCalledWith('保存されたセットを検索中...');
      
      // コンソール出力の確認（新しい形式）
      const output = consoleOutput.join('\n');
      expect(output).toContain('セット名');
      expect(output).toContain('スコープ');
      expect(output).toContain('ファイル数');
      expect(output).toContain('backend');
      expect(output).toContain('frontend');
      expect(output).toContain('合計: 2個のセット');
    });

    it('ファイル数を正しくカウントする', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.pathExists).mockImplementation((path: any) => {
        const pathStr = path.toString();
        // projectまたはuserディレクトリのみ存在
        if (pathStr.includes('/project') || pathStr.includes('/user')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });
      
      // readdirのモック
      vi.mocked(fs.readdir).mockImplementation((dirPath: any, options?: any) => {
        const pathStr = dirPath.toString();
        
        if (options?.withFileTypes) {
          if (pathStr === '/home/user/.config/claudy/sets') {
            return Promise.resolve([
              { name: 'test-set', isDirectory: () => true, isFile: () => false },
            ] as any);
          }
          if (pathStr === '/home/user/.config/claudy/sets/test-set') {
            // セットの直下にはproject/userディレクトリがあるが、
            // pathExistsで判定されるので、ここではファイルを返さない
            return Promise.resolve([]);
          }
          if (pathStr.endsWith('/test-set/project')) {
            return Promise.resolve([
              { name: 'CLAUDE.md', isDirectory: () => false, isFile: () => true },
              { name: '.claude', isDirectory: () => true, isFile: () => false },
            ] as any);
          }
          if (pathStr.endsWith('/test-set/project/.claude')) {
            return Promise.resolve([
              { name: 'commands', isDirectory: () => true, isFile: () => false },
            ] as any);
          }
          if (pathStr.endsWith('/test-set/project/.claude/commands')) {
            return Promise.resolve([
              { name: 'test.md', isDirectory: () => false, isFile: () => true },
              { name: 'deploy.md', isDirectory: () => false, isFile: () => true },
            ] as any);
          }
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        birthtime: new Date('2024-01-01'),
      } as any);

      await executeListCommand({ verbose: false });

      // コンソール出力の確認
      const output = consoleOutput.join('\n');
      expect(output).toContain('test-set');
      expect(output).toContain('3個'); // 3個のファイル
    });

    it('アクセスエラーが発生してもスキップして続行する', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.pathExists).mockImplementation((path: any) => {
        const pathStr = path.toString();
        // projectまたはuserディレクトリのみ存在
        if (pathStr.includes('/project') || pathStr.includes('/user')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });
      
      vi.mocked(fs.readdir).mockImplementation((dirPath: any, options?: any) => {
        const pathStr = dirPath.toString();
        
        if (options?.withFileTypes) {
          if (pathStr === '/home/user/.config/claudy/sets') {
            return Promise.resolve([
              { name: 'accessible', isDirectory: () => true, isFile: () => false },
              { name: 'inaccessible', isDirectory: () => true, isFile: () => false },
            ] as any);
          }
          if (pathStr.includes('accessible/project')) {
            return Promise.resolve([
              { name: 'CLAUDE.md', isDirectory: () => false, isFile: () => true },
            ] as any);
          }
          if (pathStr.includes('inaccessible')) {
            // アクセスエラー
            const error = new Error('EACCES') as NodeJS.ErrnoException;
            error.code = 'EACCES';
            return Promise.reject(error);
          }
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      
      vi.mocked(fs.stat).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes('inaccessible')) {
          const error = new Error('EACCES') as NodeJS.ErrnoException;
          error.code = 'EACCES';
          return Promise.reject(error);
        }
        return Promise.resolve({
          isDirectory: () => true,
          birthtime: new Date('2024-01-01'),
        } as any);
      });

      await executeListCommand({ verbose: false });

      // アクセス可能なセットのみ表示されることを確認
      const output = consoleOutput.join('\n');
      expect(output).toContain('accessible');
      expect(output).not.toContain('inaccessible');
      expect(output).toContain('合計: 1個のセット');
    });

    it('エラーが発生した場合、適切にラップして再スローする', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      const error = new Error('Unexpected error');
      vi.mocked(fs.readdir).mockRejectedValue(error);

      await expect(executeListCommand({ verbose: false })).rejects.toThrow();
    });
  });
});