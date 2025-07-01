import { executeListCommand } from '../../src/commands/list';

// モックの設定
jest.mock('../../src/utils/logger');
jest.mock('fs-extra', () => ({
  access: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
}));
jest.mock('../../src/utils/path');

// モジュールのインポート（モック後に行う）
import { logger } from '../../src/utils/logger';
import * as pathUtils from '../../src/utils/path';
import fs from 'fs-extra';

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockPathUtils = pathUtils as jest.Mocked<typeof pathUtils>;

// console.logのモック
const originalConsoleLog = console.log;
let consoleOutput: string[] = [];

describe('listコマンド', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleOutput = [];
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
    
    // デフォルトのモック設定
    mockPathUtils.getClaudyDir.mockReturnValue('/home/user/.claudy');
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('executeListCommand', () => {
    it('保存されたセットがない場合、適切なメッセージを表示する', async () => {
      (fs.access as any).mockResolvedValue(undefined);
      (fs.readdir as any).mockResolvedValue([]);

      await executeListCommand({ verbose: false });

      expect(mockLogger.info).toHaveBeenCalledWith('保存されたセットを検索中...');
      expect(mockLogger.info).toHaveBeenCalledWith('保存されたセットはありません');
    });

    it('保存されたセットを正しく一覧表示する', async () => {
      const mockSets = [
        {
          name: 'backend',
          isDirectory: () => true,
          isFile: () => false,
        },
        {
          name: 'frontend',
          isDirectory: () => true,
          isFile: () => false,
        },
        {
          name: '.hidden',
          isDirectory: () => true,
          isFile: () => false,
        },
        {
          name: 'profiles',
          isDirectory: () => true,
          isFile: () => false,
        },
        {
          name: 'file.txt',
          isDirectory: () => false,
          isFile: () => true,
        },
      ];

      (fs.access as any).mockResolvedValue(undefined);
      
      // statのモック
      (fs.stat as any).mockImplementation((path: any) => {
        const pathStr = path.toString();
        const birthtime = new Date('2024-01-01');
        return Promise.resolve({
          isDirectory: () => !pathStr.includes('file.txt'),
          birthtime,
        } as any);
      });

      // readdirのモック（ファイル数カウント用）
      const readdirCalls = new Map<string, number>();
      (fs.readdir as any).mockImplementation((dirPath: any, options?: any) => {
        const pathStr = dirPath.toString();
        
        // 同じパスへの呼び出し回数を記録（無限ループ防止）
        const callCount = readdirCalls.get(pathStr) || 0;
        readdirCalls.set(pathStr, callCount + 1);
        if (callCount > 10) {
          return Promise.resolve([]);
        }
        
        if (options?.withFileTypes) {
          if (pathStr === '/home/user/.claudy') {
            return Promise.resolve(mockSets as any);
          }
          // セット内のファイル（簡略化）
          if (pathStr.includes('/home/user/.claudy/')) {
            return Promise.resolve([
              { name: 'CLAUDE.md', isDirectory: () => false, isFile: () => true },
            ] as any);
          }
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      await executeListCommand({ verbose: false });

      expect(mockLogger.info).toHaveBeenCalledWith('保存されたセットを検索中...');
      
      // コンソール出力の確認
      expect(consoleOutput).toContain('セット名\t作成日時\t\tファイル数');
      expect(consoleOutput.some(line => line.includes('backend'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('frontend'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('合計: 2個のセット'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('ヒント: claudy load <セット名> で設定を展開できます'))).toBe(true);
      
      // 非表示ファイルとprofilesディレクトリは表示されないことを確認
      expect(consoleOutput.some(line => line.includes('.hidden'))).toBe(false);
      expect(consoleOutput.some(line => line.includes('profiles'))).toBe(false);
    });

    it('ファイル数を正しくカウントする', async () => {
      const mockSets = [
        {
          name: 'test-set',
          isDirectory: () => true,
        },
      ];

      (fs.access as any).mockResolvedValue(undefined);
      
      // readdirのモック - 階層構造を持つファイルシステムを再現
      const readdirCalls = new Map<string, number>();
      (fs.readdir as any).mockImplementation((dirPath: any, options?: any) => {
        const pathStr = dirPath.toString();
        
        // 同じパスへの呼び出し回数を記録（無限ループ防止）
        const callCount = readdirCalls.get(pathStr) || 0;
        readdirCalls.set(pathStr, callCount + 1);
        if (callCount > 10) {
          return Promise.resolve([]);
        }
        
        if (options?.withFileTypes) {
          if (pathStr === '/home/user/.claudy') {
            return Promise.resolve(mockSets as any);
          }
          if (pathStr === '/home/user/.claudy/test-set') {
            return Promise.resolve([
              { name: 'CLAUDE.md', isDirectory: () => false, isFile: () => true },
              { name: '.claude', isDirectory: () => true, isFile: () => false },
            ] as any);
          }
          if (pathStr === '/home/user/.claudy/test-set/.claude') {
            return Promise.resolve([
              { name: 'commands', isDirectory: () => true, isFile: () => false },
            ] as any);
          }
          if (pathStr.includes('commands')) {
            return Promise.resolve([
              { name: 'test.md', isDirectory: () => false, isFile: () => true },
              { name: 'deploy.md', isDirectory: () => false, isFile: () => true },
            ] as any);
          }
        }
        return Promise.resolve([]);
      });

      (fs.stat as any).mockResolvedValue({
        isDirectory: () => true,
        birthtime: new Date('2024-01-01'),
      } as any);

      await executeListCommand({ verbose: false });

      // 3個のファイル（CLAUDE.md, test.md, deploy.md）が表示されることを確認
      expect(consoleOutput.some(line => line.includes('test-set') && line.includes('3個'))).toBe(true);
    });

    it.skip('アクセスエラーが発生してもスキップして続行する', async () => {
      const mockSets = [
        {
          name: 'accessible',
          isDirectory: () => true,
        },
        {
          name: 'inaccessible',
          isDirectory: () => true,
        },
      ];

      (fs.access as any).mockResolvedValue(undefined);
      
      const readdirCalls = new Map<string, number>();
      (fs.readdir as any).mockImplementation((dirPath: any, options?: any) => {
        const pathStr = dirPath.toString();
        
        // 同じパスへの呼び出し回数を記録（無限ループ防止）
        const callCount = readdirCalls.get(pathStr) || 0;
        readdirCalls.set(pathStr, callCount + 1);
        if (callCount > 10) {
          return Promise.resolve([]);
        }
        
        if (options?.withFileTypes) {
          if (pathStr === '/home/user/.claudy') {
            return Promise.resolve(mockSets as any);
          }
          return Promise.resolve([
            { name: 'CLAUDE.md', isDirectory: () => false, isFile: () => true },
          ] as any);
        }
        return Promise.resolve([]);
      });
      
      (fs.stat as any).mockImplementation((path: any) => {
        const pathStr = path.toString();
        if (pathStr.includes('inaccessible')) {
          // getSetInfoでアクセスエラーがnullとして扱われる
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
      expect(consoleOutput.some(line => line.includes('accessible'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('inaccessible'))).toBe(false);
      expect(consoleOutput.some(line => line.includes('合計: 1個のセット'))).toBe(true);
    });

    it('エラーが発生した場合、適切にラップして再スローする', async () => {
      (fs.access as any).mockResolvedValue(undefined);
      const error = new Error('Unexpected error');
      (fs.readdir as any).mockRejectedValue(error);

      await expect(executeListCommand({ verbose: false })).rejects.toThrow();
    });
  });
});