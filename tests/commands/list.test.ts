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

describe.skip('listコマンド', () => {
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
      (fs.access as any).mockRejectedValue(new Error('ENOENT'));

      await executeListCommand({ verbose: false });

      expect(mockLogger.info).toHaveBeenCalledWith('保存されたセットはありません');
      expect(mockLogger.info).toHaveBeenCalledWith('まず claudy save <name> でセットを保存してください');
    });

    it('保存されたセットを正しく一覧表示する', async () => {
      const mockSets = [
        {
          name: 'frontend',
          isDirectory: () => true,
        },
        {
          name: 'backend',
          isDirectory: () => true,
        },
        {
          name: '.hidden',
          isDirectory: () => true,
        },
        {
          name: 'profiles',
          isDirectory: () => true,
        },
        {
          name: 'file.txt',
          isDirectory: () => false,
        },
      ];

      (fs.access as any).mockResolvedValue(undefined);
      (fs.readdir as any).mockResolvedValue(mockSets as any);
      
      // statのモック（各セットの情報）
      (fs.stat as any).mockImplementation((path: any) => {
        const pathStr = path.toString();
        const birthtime = new Date('2024-01-01');
        return Promise.resolve({
          isDirectory: () => !pathStr.includes('file.txt'),
          birthtime,
        } as any);
      });

      // readdirのモック（ファイル数カウント用）
      (fs.readdir as any).mockImplementation((dirPath: any, options?: any) => {
        const pathStr = dirPath.toString();
        if (options?.withFileTypes) {
          if (pathStr === '/home/user/.claudy') {
            return Promise.resolve(mockSets as any);
          }
          // セット内のファイル
          return Promise.resolve([
            { name: 'CLAUDE.md', isDirectory: () => false, isFile: () => true },
            { name: '.claude', isDirectory: () => true, isFile: () => false },
          ] as any);
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
      (fs.readdir as any).mockImplementation((dirPath: any, options?: any) => {
        const pathStr = dirPath.toString();
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

    it('アクセスエラーが発生してもスキップして続行する', async () => {
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
      (fs.readdir as any).mockImplementation((dirPath: any, options?: any) => {
        const pathStr = dirPath.toString();
        if (options?.withFileTypes) {
          if (pathStr === '/home/user/.claudy') {
            return Promise.resolve(mockSets as any);
          }
          if (pathStr.includes('inaccessible')) {
            const error = new Error('Permission denied') as NodeJS.ErrnoException;
            error.code = 'EACCES';
            return Promise.reject(error);
          }
          return Promise.resolve([
            { name: 'CLAUDE.md', isDirectory: () => false, isFile: () => true },
          ] as any);
        }
        return Promise.resolve([]);
      });

      (fs.stat as any).mockImplementation((statPath: any) => {
        const pathStr = statPath.toString();
        if (pathStr.includes('inaccessible')) {
          const error = new Error('Permission denied') as NodeJS.ErrnoException;
          error.code = 'EACCES';
          return Promise.reject(error);
        }
        return Promise.resolve({
          isDirectory: () => true,
          birthtime: new Date('2024-01-01'),
        } as any);
      });

      await executeListCommand({ verbose: true });

      // アクセス可能なセットのみ表示される
      expect(consoleOutput.some(line => line.includes('accessible'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('inaccessible'))).toBe(false);
      expect(consoleOutput.some(line => line.includes('合計: 1個のセット'))).toBe(true);
    });

    it('エラーが発生した場合、適切にラップして再スローする', async () => {
      const testError = new Error('Unexpected error');
      (fs.access as any).mockRejectedValue(testError);

      await expect(executeListCommand({ verbose: false })).rejects.toThrow();
    });
  });
});