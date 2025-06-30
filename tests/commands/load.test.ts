import { Command } from 'commander';
import { registerLoadCommand } from '../../src/commands/load';
import { stat, copy, rename } from 'fs-extra';
import { glob } from 'glob';
import inquirer from 'inquirer';

// モックの設定
jest.mock('fs-extra');
jest.mock('glob');
jest.mock('inquirer');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    setVerbose: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../src/utils/path', () => ({
  getClaudyDir: jest.fn(() => '/home/user/.claudy'),
}));

const mockStat = stat as unknown as jest.Mock;
const mockCopy = copy as unknown as jest.Mock;
const mockRename = rename as unknown as jest.Mock;
const mockGlob = glob as unknown as jest.MockedFunction<(pattern: string, options?: any) => Promise<string[]>>;
const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;

describe('loadコマンド', () => {
  let program: Command;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    program = new Command();
    program.exitOverride();
    registerLoadCommand(program);
    
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });
    
    jest.spyOn(process, 'cwd').mockReturnValue('/project');
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  describe('正常系', () => {
    beforeEach(() => {
      // セットの存在確認用のモック
      mockStat.mockImplementation(async (path) => {
        if (path === '/home/user/.claudy/test-set') {
          return {} as any;
        }
        throw new Error('Not found');
      });

      // glob のモック
      mockGlob.mockImplementation(async (pattern) => {
        if (pattern === 'CLAUDE.md') {
          return ['CLAUDE.md'];
        } else if (pattern === '.claude/**/*.md') {
          return ['.claude/commands/test.md'];
        }
        return [];
      });

      // copy のモック
      mockCopy.mockResolvedValue(undefined);
    });

    it('セットを正常に展開できる', async () => {
      await program.parseAsync(['node', 'claudy', 'load', 'test-set']);
      
      expect(mockCopy).toHaveBeenCalledTimes(2);
      expect(mockCopy).toHaveBeenCalledWith(
        '/home/user/.claudy/test-set/CLAUDE.md',
        '/project/CLAUDE.md',
        { overwrite: true, preserveTimestamps: true }
      );
    });

    it('forceオプションで既存ファイルを上書きできる', async () => {
      // 既存ファイルがある状態をモック
      mockStat.mockImplementation(async (path) => {
        if (path === '/home/user/.claudy/test-set' || 
            path === '/project/CLAUDE.md' || 
            path === '/project/.claude/commands/test.md') {
          return {} as any;
        }
        throw new Error('Not found');
      });

      await program.parseAsync(['node', 'claudy', 'load', 'test-set', '-f']);
      
      expect(mockInquirer.prompt).not.toHaveBeenCalled();
      expect(mockCopy).toHaveBeenCalled();
    });
  });

  describe('異常系', () => {
    it('存在しないセットを指定した場合エラーになる', async () => {
      mockStat.mockRejectedValue(new Error('Not found'));

      await expect(
        program.parseAsync(['node', 'claudy', 'load', 'nonexistent'])
      ).rejects.toThrow('Process exit');
      
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('対話的処理', () => {
    beforeEach(() => {
      // セットの存在確認とファイル衝突のモック
      mockStat.mockImplementation(async (path) => {
        if (path === '/home/user/.claudy/test-set' || 
            path === '/project/CLAUDE.md') {
          return {} as any;
        }
        throw new Error('Not found');
      });

      mockGlob.mockImplementation(async (pattern) => {
        if (pattern === 'CLAUDE.md') {
          return ['CLAUDE.md'];
        }
        return [];
      });
      mockRename.mockResolvedValue(undefined);
    });

    it('バックアップオプションを選択した場合、.bakファイルが作成される', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({ action: 'backup' });

      await program.parseAsync(['node', 'claudy', 'load', 'test-set']);
      
      expect(mockRename).toHaveBeenCalledWith(
        '/project/CLAUDE.md',
        '/project/CLAUDE.md.bak'
      );
      expect(mockCopy).toHaveBeenCalled();
    });

    it('キャンセルオプションを選択した場合、ファイルは変更されない', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({ action: 'cancel' });

      await program.parseAsync(['node', 'claudy', 'load', 'test-set']);
      
      expect(mockRename).not.toHaveBeenCalled();
      expect(mockCopy).not.toHaveBeenCalled();
    });

    it('上書きオプションを選択した場合、バックアップなしで展開される', async () => {
      mockInquirer.prompt.mockResolvedValueOnce({ action: 'overwrite' });

      await program.parseAsync(['node', 'claudy', 'load', 'test-set']);
      
      expect(mockRename).not.toHaveBeenCalled();
      expect(mockCopy).toHaveBeenCalled();
    });
  });
});