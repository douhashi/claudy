import { executeSaveCommand } from '../../src/commands/save';
import { ClaudyError } from '../../src/types';
import fs from 'fs-extra';
import path from 'path';
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
  },
}));

// path.join のモック用に、実際の path モジュールを使用
jest.mock('../../src/utils/path', () => ({
  getClaudyDir: jest.fn(() => '/home/user/.claudy'),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockGlob = glob as unknown as jest.MockedFunction<(pattern: string, options?: any) => Promise<string[]>>;
const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;

describe('saveコマンド', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルトのモック動作を設定
    (mockFs.access as unknown as jest.Mock).mockResolvedValue(undefined);
    (mockFs.copy as unknown as jest.Mock).mockResolvedValue(undefined);
    (mockFs.ensureDir as unknown as jest.Mock).mockResolvedValue(undefined);
  });

  describe('セット名のバリデーション', () => {
    it('空のセット名はエラーになる', async () => {
      await expect(executeSaveCommand('', {})).rejects.toThrow(
        new ClaudyError('セット名が指定されていません', 'INVALID_SET_NAME')
      );
    });

    it('無効な文字を含むセット名はエラーになる', async () => {
      const invalidNames = ['test/name', 'test\\name', 'test:name', 'test*name', 'test?name', 'test"name', 'test<name', 'test>name', 'test|name'];
      
      for (const name of invalidNames) {
        await expect(executeSaveCommand(name, {})).rejects.toThrow(
          new ClaudyError(
            'セット名に使用できない文字が含まれています（/, \\, :, *, ?, ", <, >, |）',
            'INVALID_SET_NAME'
          )
        );
      }
    });

    it('255文字を超えるセット名はエラーになる', async () => {
      const longName = 'a'.repeat(256);
      await expect(executeSaveCommand(longName, {})).rejects.toThrow(
        new ClaudyError('セット名は255文字以内で指定してください', 'INVALID_SET_NAME')
      );
    });
  });

  describe('ファイル検索', () => {
    it('ファイルが見つからない場合はエラーになる', async () => {
      mockGlob.mockResolvedValue([]);

      await expect(executeSaveCommand('test-set', {})).rejects.toThrow(
        new ClaudyError('Claude設定ファイルが見つかりませんでした', 'NO_FILES_FOUND')
      );
    });

    it('CLAUDE.mdと.claude/commands/**/*.mdファイルを検索する', async () => {
      mockGlob
        .mockResolvedValueOnce(['CLAUDE.md'])
        .mockResolvedValueOnce(['.claude/commands/test.md']);
      
      // 既存セットがないと仮定
      (mockFs.access as unknown as jest.Mock).mockRejectedValueOnce(new Error('Not found'));

      await executeSaveCommand('test-set', {});

      expect(mockGlob).toHaveBeenCalledTimes(2);
      expect(mockGlob).toHaveBeenCalledWith('CLAUDE.md', expect.any(Object));
      expect(mockGlob).toHaveBeenCalledWith('.claude/commands/**/*.md', expect.any(Object));
    });
  });

  describe('既存セットの上書き処理', () => {
    beforeEach(() => {
      mockGlob
        .mockResolvedValueOnce(['CLAUDE.md'])
        .mockResolvedValueOnce([]);
    });

    it('既存セットがある場合、確認プロンプトを表示する', async () => {
      (mockFs.access as unknown as jest.Mock).mockResolvedValueOnce(undefined); // セットが存在
      (mockInquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({ overwrite: true });

      await executeSaveCommand('test-set', {});

      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'セット "test-set" は既に存在します。上書きしますか？',
          default: false,
        },
      ]);
    });

    it('上書きをキャンセルした場合、処理を中断する', async () => {
      (mockFs.access as unknown as jest.Mock).mockResolvedValueOnce(undefined); // セットが存在
      (mockInquirer.prompt as unknown as jest.Mock).mockResolvedValueOnce({ overwrite: false });

      await executeSaveCommand('test-set', {});

      expect(mockFs.copy).not.toHaveBeenCalled();
    });

    it('--forceオプションがある場合、確認なしで上書きする', async () => {
      (mockFs.access as unknown as jest.Mock).mockResolvedValueOnce(undefined); // セットが存在

      await executeSaveCommand('test-set', { force: true });

      expect(mockInquirer.prompt).not.toHaveBeenCalled();
      expect(mockFs.copy).toHaveBeenCalled();
    });

    it('既存セットがない場合、確認なしで保存する', async () => {
      (mockFs.access as unknown as jest.Mock).mockRejectedValueOnce(new Error('Not found')); // セットが存在しない

      await executeSaveCommand('test-set', {});

      expect(mockInquirer.prompt).not.toHaveBeenCalled();
      expect(mockFs.copy).toHaveBeenCalled();
    });
  });

  describe('ファイルコピー処理', () => {
    beforeEach(() => {
      (mockFs.access as unknown as jest.Mock).mockRejectedValueOnce(new Error('Not found')); // セットが存在しない
    });

    it('見つかったファイルをコピーする', async () => {
      const files = ['CLAUDE.md', '.claude/commands/test1.md', '.claude/commands/test2.md'];
      mockGlob
        .mockResolvedValueOnce(['CLAUDE.md'])
        .mockResolvedValueOnce(['.claude/commands/test1.md', '.claude/commands/test2.md']);

      await executeSaveCommand('test-set', {});

      expect(mockFs.ensureDir).toHaveBeenCalledTimes(3);
      expect(mockFs.copy).toHaveBeenCalledTimes(3);
      
      files.forEach(file => {
        expect(mockFs.copy).toHaveBeenCalledWith(
          path.join(process.cwd(), file),
          path.join('/home/user/.claudy', 'test-set', file),
          { overwrite: true }
        );
      });
    });

    it('ディレクトリ構造を維持してコピーする', async () => {
      mockGlob
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['.claude/commands/subdir/test.md']);

      await executeSaveCommand('test-set', {});

      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        path.dirname(path.join('/home/user/.claudy', 'test-set', '.claude/commands/subdir/test.md'))
      );
    });
  });

  describe('エラーハンドリング', () => {
    it('ファイルコピー中のエラーを適切に処理する', async () => {
      mockGlob
        .mockResolvedValueOnce(['CLAUDE.md'])
        .mockResolvedValueOnce([]);
      (mockFs.access as unknown as jest.Mock).mockRejectedValueOnce(new Error('Not found')); // セットが存在しない
      (mockFs.copy as unknown as jest.Mock).mockRejectedValueOnce(new Error('Copy error'));

      await expect(executeSaveCommand('test-set', {})).rejects.toThrow(
        new ClaudyError('セットの保存中にエラーが発生しました', 'SAVE_ERROR')
      );
    });
  });
});