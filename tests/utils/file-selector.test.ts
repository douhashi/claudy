import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { setupI18n } from '../helpers/i18n-test-helper';
import path from 'path';
import os from 'os';
import fsExtra from 'fs-extra';
const fs = fsExtra;
import inquirer from 'inquirer';
import { glob } from 'glob';
import {
  findClaudeFiles,
  findUserClaudeFiles,
  formatFilePath,
  selectFilesInteractively,
  selectFilesWithCheckbox,
  performFileSelection,
  FileSearchResult,
} from '../../src/utils/file-selector';

// Mocks
vi.mock('glob');
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn(),
  },
}));
vi.mock('inquirer');
vi.mock('../../src/utils/logger');
vi.mock('../../src/utils/reference-parser', () => ({
  collectReferences: vi.fn(() => Promise.resolve([])),
}));

const mockGlob = vi.mocked(glob);
const mockFs = vi.mocked(fsExtra) as any;
const mockInquirer = vi.mocked(inquirer);

describe('file-selector', () => {
  const testCwd = '/test/project';
  const homeDir = '/home/testuser';
  
  beforeAll(async () => {
    await setupI18n();
  });
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(testCwd);
    vi.spyOn(os, 'homedir').mockReturnValue(homeDir);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('findClaudeFiles', () => {
    it('should find all Claude-related files', async () => {
      mockGlob.mockImplementation(async (pattern) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        if (pattern === 'CLAUDE.local.md') return ['CLAUDE.local.md'];
        if (pattern === '.claude/**/*.md') return ['.claude/commands/test.md'];
        return [];
      });
      
      const files = await findClaudeFiles(testCwd, false);
      
      expect(files).toEqual({
        mainFiles: [
          '.claude/commands/test.md',
          'CLAUDE.local.md',
          'CLAUDE.md'
        ],
        referencedFiles: []
      });
      expect(mockGlob).toHaveBeenCalledTimes(3);
    });
    
    it('should handle glob errors gracefully', async () => {
      mockGlob.mockImplementation(async (pattern) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        if (pattern === '.claude/**/*.md') throw new Error('Permission denied');
        return [];
      });
      
      const files = await findClaudeFiles(testCwd, false);
      
      expect(files).toEqual({
        mainFiles: ['CLAUDE.md'],
        referencedFiles: []
      });
    });
    
    it('should remove duplicates and sort files', async () => {
      mockGlob.mockImplementation(async () => ['CLAUDE.md', 'CLAUDE.md']);
      
      const files = await findClaudeFiles(testCwd, false);
      
      expect(files).toEqual({
        mainFiles: ['CLAUDE.md'],
        referencedFiles: []
      });
    });
  });
  
  describe('findUserClaudeFiles', () => {
    it('should find user-level Claude files', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockGlob.mockResolvedValue(['commands/custom.md', 'commands/another.md']);
      
      const result = await findUserClaudeFiles(false);
      
      expect(result).toEqual({
        files: {
          mainFiles: [
            '.claude/CLAUDE.md',
            '.claude/commands/custom.md',
            '.claude/commands/another.md'
          ],
          referencedFiles: []
        },
        baseDir: homeDir
      });
      expect(mockFs.pathExists).toHaveBeenCalledWith(path.join(homeDir, '.claude', 'CLAUDE.md'));
    });
    
    it('should handle missing user CLAUDE.md', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      mockGlob.mockResolvedValue(['commands/custom.md']);
      
      const result = await findUserClaudeFiles(false);
      
      expect(result).toEqual({
        files: {
          mainFiles: ['.claude/commands/custom.md'],
          referencedFiles: []
        },
        baseDir: homeDir
      });
    });
    
    it('should handle glob errors in user directory', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockGlob.mockRejectedValue(new Error('Permission denied'));
      
      const result = await findUserClaudeFiles(false);
      
      expect(result).toEqual({
        files: {
          mainFiles: ['.claude/CLAUDE.md'],
          referencedFiles: []
        },
        baseDir: homeDir
      });
    });
  });
  
  describe('formatFilePath', () => {
    it('should format project-level files with ./ prefix', () => {
      const formatted = formatFilePath('CLAUDE.md', testCwd, false);
      expect(formatted).toBe('./CLAUDE.md');
    });
    
    it('should format user-level files with ~/ prefix', () => {
      const formatted = formatFilePath('.claude/CLAUDE.md', homeDir, true);
      expect(formatted).toBe('~/.claude/CLAUDE.md');
    });
    
    it('should handle nested project files', () => {
      const formatted = formatFilePath('.claude/commands/test.md', testCwd, false);
      expect(formatted).toBe('./.claude/commands/test.md');
    });
  });
  
  describe('selectFilesInteractively', () => {
    it('should use group selection when both project and user files exist', async () => {
      const projectFiles: FileSearchResult = {
        mainFiles: ['CLAUDE.md', '.claude/commands/test.md'],
        referencedFiles: []
      };
      const userFiles: FileSearchResult = {
        mainFiles: ['.claude/CLAUDE.md'],
        referencedFiles: []
      };
      
      // Mock group selection - select both
      mockInquirer.prompt
        .mockResolvedValueOnce({ selection: 'both' });
      
      const results = await selectFilesInteractively(projectFiles, userFiles, homeDir);
      
      expect(mockInquirer.prompt).toHaveBeenCalledWith({
        type: 'list',
        name: 'selection',
        message: 'ファイルの選択方法を選んでください:',
        choices: expect.arrayContaining([
          expect.objectContaining({ name: '両方のファイル（プロジェクトレベル + ユーザーレベル）', value: 'both' }),
          expect.objectContaining({ name: 'プロジェクトレベルのファイルのみ', value: 'project' }),
          expect.objectContaining({ name: 'ユーザーレベルのファイルのみ', value: 'user' }),
          expect.objectContaining({ name: 'カスタム選択（個別にファイルを選択）', value: 'custom' })
        ]),
        default: 'both'
      });
      
      expect(results).toEqual([
        { files: projectFiles.mainFiles, baseDir: testCwd },
        { files: userFiles.mainFiles, baseDir: homeDir }
      ]);
    });
    
    it('should allow custom selection with inquirer.Separator', async () => {
      const projectFiles = {
        mainFiles: ['CLAUDE.md', '.claude/commands/test.md'],
        referencedFiles: []
      };
      const userFiles = {
        mainFiles: ['.claude/CLAUDE.md'],
        referencedFiles: []
      };
      
      // Mock group selection - custom
      mockInquirer.prompt
        .mockResolvedValueOnce({ selection: 'custom' })
        .mockResolvedValueOnce({
          selectedFiles: ['project:CLAUDE.md', 'user:.claude/CLAUDE.md']
        });
      
      const results = await selectFilesInteractively(projectFiles, userFiles, homeDir);
      
      // First call is group selection
      expect(mockInquirer.prompt).toHaveBeenCalledTimes(2);
      
      // Second call should include separators
      const secondCall = mockInquirer.prompt.mock.calls[1][0];
      expect(secondCall.choices).toContainEqual(expect.any(inquirer.Separator));
      
      expect(results).toEqual([
        { files: ['CLAUDE.md'], baseDir: testCwd },
        { files: ['.claude/CLAUDE.md'], baseDir: homeDir }
      ]);
    });
    
    it('should handle empty file selection', async () => {
      const projectFiles: FileSearchResult = {
        mainFiles: [],
        referencedFiles: []
      };
      const userFiles: FileSearchResult = {
        mainFiles: [],
        referencedFiles: []
      };
      
      await expect(selectFilesInteractively(projectFiles, userFiles, homeDir))
        .rejects.toThrow('No Claude-related files found');
    });
    
    it('should validate at least one file is selected in custom mode', async () => {
      const projectFiles: FileSearchResult = {
        mainFiles: ['CLAUDE.md'],
        referencedFiles: []
      };
      const userFiles: FileSearchResult = {
        mainFiles: [],
        referencedFiles: []
      };
      
      // @ts-expect-error - Mocking inquirer prompt for testing
      mockInquirer.prompt.mockImplementation(async (questions: unknown) => {
        const question = questions as { 
          name?: string;
          validate?: (input: unknown) => boolean | string 
        };
        
        if (question.name === 'selection') {
          return { selection: 'custom' };
        }
        
        if (question.validate) {
          const validateResult = question.validate([]);
          expect(typeof validateResult).toBe('string');
          expect(validateResult).toBeTruthy(); // エラーメッセージが返される
        }
        
        return { selectedFiles: ['project:CLAUDE.md'] };
      });
      
      await selectFilesInteractively(projectFiles, userFiles, homeDir);
    });
  });
  
  describe('selectFilesWithCheckbox', () => {
    it('should use default selection function correctly', async () => {
      const projectFiles: FileSearchResult = {
        mainFiles: ['CLAUDE.md'],
        referencedFiles: []
      };
      const userFiles: FileSearchResult = {
        mainFiles: ['.claude/CLAUDE.md'],
        referencedFiles: []
      };
      
      // デフォルト選択関数: プロジェクトレベルのみ選択
      const defaultSelection = (file: string, isUserLevel: boolean) => !isUserLevel;
      
      mockInquirer.prompt.mockResolvedValue({
        selectedFiles: ['project:CLAUDE.md']  // プロジェクトファイルのみ選択
      });
      
      const results = await selectFilesWithCheckbox(projectFiles, userFiles, homeDir, defaultSelection);
      
      // inquirer.promptの呼び出しを検証
      const promptCall = mockInquirer.prompt.mock.calls[0][0];
      const choices = promptCall.choices.filter((c: any) => c.value);
      
      // プロジェクトファイルはデフォルトでチェックされている
      expect(choices.find((c: any) => c.value === 'project:CLAUDE.md').checked).toBe(true);
      // ユーザーファイルはデフォルトでチェックされていない
      expect(choices.find((c: any) => c.value === 'user:.claude/CLAUDE.md').checked).toBe(false);
      
      expect(results).toEqual([
        { files: ['CLAUDE.md'], baseDir: testCwd }
      ]);
    });
    
    it('should show all files as checked without default selection function', async () => {
      const projectFiles: FileSearchResult = {
        mainFiles: ['CLAUDE.md'],
        referencedFiles: []
      };
      const userFiles: FileSearchResult = {
        mainFiles: ['.claude/CLAUDE.md'],
        referencedFiles: []
      };
      
      mockInquirer.prompt.mockResolvedValue({
        selectedFiles: ['project:CLAUDE.md', 'user:.claude/CLAUDE.md']
      });
      
      // デフォルト選択関数を指定しない場合
      const results = await selectFilesWithCheckbox(projectFiles, userFiles, homeDir);
      
      // inquirer.promptの呼び出しを検証
      const promptCall = mockInquirer.prompt.mock.calls[0][0];
      const choices = promptCall.choices.filter((c: any) => c.value);
      
      // すべてのファイルがデフォルトでチェックされている
      choices.forEach((choice: any) => {
        expect(choice.checked).toBe(true);
      });
      
      expect(results).toHaveLength(2);
    });
  });
  
  describe('performFileSelection', () => {
    it('should perform complete file selection flow with direct checkbox UI', async () => {
      // 明示的にmocksをクリア
      vi.clearAllMocks();
      
      // プロジェクトファイルの検索で CLAUDE.md を返す
      mockGlob
        .mockResolvedValueOnce(['CLAUDE.md'])  // 1回目: プロジェクトの CLAUDE.md
        .mockResolvedValueOnce([])            // 2回目: プロジェクトの CLAUDE.local.md
        .mockResolvedValueOnce([])            // 3回目: プロジェクトの .claude/**/*.md
        .mockResolvedValueOnce([]);           // 4回目: ユーザーの commands/**/*.md
      
      // ユーザーファイルは存在しない
      mockFs.pathExists.mockResolvedValue(false);
      
      // チェックボックスでプロジェクトファイルが選択される
      mockInquirer.prompt.mockResolvedValue({ 
        selectedFiles: ['project:CLAUDE.md']
      });
      
      const results = await performFileSelection();
      
      // 1回だけprompが呼ばれる（グループ選択なし、直接チェックボックス）
      expect(mockInquirer.prompt).toHaveBeenCalledTimes(1);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        files: ['CLAUDE.md'],
        baseDir: testCwd
      });
    });
    
    it('should handle empty file selection', async () => {
      // Mock no files found
      mockGlob.mockResolvedValue([]);
      mockFs.pathExists.mockResolvedValue(false);
      
      await expect(performFileSelection())
        .rejects.toThrow('No Claude-related files found');
    });
  });
});