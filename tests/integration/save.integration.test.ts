import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { setupI18n } from '../helpers/i18n-test-helper';
import { executeSaveCommand } from '../../src/commands/save';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// テスト用のテンポラリディレクトリ
const testBaseDir = path.join(os.tmpdir(), 'claudy-test', Date.now().toString());
const testClaudyDir = path.join(testBaseDir, '.claudy-test');

// utils/pathのモック
vi.mock('../../src/utils/path', () => {
  const path = require('path');
  return {
    getClaudyDir: vi.fn(() => testClaudyDir),
    getProjectConfigDir: vi.fn(() => testClaudyDir),
    getSetsDir: vi.fn(() => path.join(testClaudyDir, 'sets')),
    getSetDir: vi.fn((setName) => path.join(testClaudyDir, 'sets', setName)),
    validateSetName: vi.fn(() => {}),
    getHomeDir: vi.fn(() => testBaseDir),
  };
});

// loggerのモック（実際の出力を抑制）
vi.mock('../../src/utils/logger', () => ({
  logger: {
    setVerbose: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// inquirerのモック（統合テストでは確認プロンプトを避ける）
vi.mock('inquirer');

// file-selectorのモック（統合テストでは自動選択を避ける）
vi.mock('../../src/utils/file-selector');

// 実際のファイルシステムを使用する統合テスト
describe('saveコマンド統合テスト', () => {
  const testDir = path.join(testBaseDir, 'work');

  beforeAll(async () => {
    await setupI18n();
  });

  beforeEach(async () => {
    // テスト用ディレクトリを作成
    await fs.ensureDir(testDir);
    process.chdir(testDir);
  });

  afterEach(async () => {
    // テスト用ディレクトリをクリーンアップ
    await fs.remove(testBaseDir);
  });

  describe('正常系', () => {
    it('CLAUDE.mdファイルのみを保存する', async () => {
      // テスト用ファイルを作成
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Test CLAUDE.md\n');

      // saveコマンドを実行（--allオプションで全ファイルを自動保存）
      await executeSaveCommand('test-set', { all: true });

      // ファイルが正しく保存されたか確認
      const savedFile = path.join(testClaudyDir, 'sets', 'test-set', 'project', 'CLAUDE.md');
      expect(await fs.pathExists(savedFile)).toBe(true);
      expect(await fs.readFile(savedFile, 'utf-8')).toBe('# Test CLAUDE.md\n');
    });

    it('複数のファイルを正しいディレクトリ構造で保存する', async () => {
      // テスト用ファイルを作成
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# Main CLAUDE.md\n');
      await fs.ensureDir(path.join(testDir, '.claude', 'commands'));
      await fs.writeFile(
        path.join(testDir, '.claude', 'commands', 'test1.md'),
        '# Test Command 1\n'
      );
      await fs.ensureDir(path.join(testDir, '.claude', 'commands', 'subdir'));
      await fs.writeFile(
        path.join(testDir, '.claude', 'commands', 'subdir', 'test2.md'),
        '# Test Command 2\n'
      );

      // saveコマンドを実行（--allオプションで全ファイルを自動保存）
      await executeSaveCommand('test-set', { all: true });

      // ファイルが正しく保存されたか確認
      const setDir = path.join(testClaudyDir, 'sets', 'test-set', 'project');
      expect(await fs.pathExists(path.join(setDir, 'CLAUDE.md'))).toBe(true);
      expect(await fs.pathExists(path.join(setDir, '.claude', 'commands', 'test1.md'))).toBe(true);
      expect(await fs.pathExists(path.join(setDir, '.claude', 'commands', 'subdir', 'test2.md'))).toBe(true);

      // 内容も確認
      expect(await fs.readFile(path.join(setDir, 'CLAUDE.md'), 'utf-8')).toBe('# Main CLAUDE.md\n');
      expect(await fs.readFile(path.join(setDir, '.claude', 'commands', 'test1.md'), 'utf-8')).toBe('# Test Command 1\n');
      expect(await fs.readFile(path.join(setDir, '.claude', 'commands', 'subdir', 'test2.md'), 'utf-8')).toBe('# Test Command 2\n');
    });

    it('既存セットを--forceオプションで上書きする', async () => {
      // 既存のセットを作成
      const setDir = path.join(testClaudyDir, 'sets', 'test-set', 'project');
      await fs.ensureDir(setDir);
      await fs.writeFile(path.join(setDir, 'old.md'), '# Old file\n');

      // 新しいファイルを作成
      await fs.writeFile(path.join(testDir, 'CLAUDE.md'), '# New CLAUDE.md\n');

      // saveコマンドを実行（--allと--forceオプション付き）
      await executeSaveCommand('test-set', { all: true, force: true });

      // 新しいファイルで上書きされたか確認
      expect(await fs.pathExists(path.join(setDir, 'old.md'))).toBe(false); // 既存ファイルは削除される（ディレクトリクリーンアップ）
      expect(await fs.pathExists(path.join(setDir, 'CLAUDE.md'))).toBe(true);
      expect(await fs.readFile(path.join(setDir, 'CLAUDE.md'), 'utf-8')).toBe('# New CLAUDE.md\n');
    });
  });

  describe('異常系', () => {
    it('対象ファイルが存在しない場合エラーになる', async () => {
      // 何もファイルを作成しない

      await expect(executeSaveCommand('test-set', { all: true })).rejects.toThrow();
    });

    it('.claude/commands以外の.mdファイルは無視される', async () => {
      // 対象外のファイルを作成
      await fs.writeFile(path.join(testDir, 'README.md'), '# README\n');
      await fs.writeFile(path.join(testDir, 'docs.md'), '# Docs\n');
      await fs.ensureDir(path.join(testDir, 'other'));
      await fs.writeFile(path.join(testDir, 'other', 'test.md'), '# Other\n');

      await expect(executeSaveCommand('test-set', { all: true })).rejects.toThrow();
    });
  });
});