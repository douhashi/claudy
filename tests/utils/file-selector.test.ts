import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
        .rejects.toThrow('Claude関連ファイルが見つかりませんでした');
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
          expect(validateResult).toBe('少なくとも1つのファイルを選択してください');
        }
        
        return { selectedFiles: ['project:CLAUDE.md'] };
      });
      
      await selectFilesInteractively(projectFiles, userFiles, homeDir);
    });
  });
  
  describe('performFileSelection', () => {
    it('should perform complete file selection flow', async () => {
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
      
      // プロジェクトファイルのみを選択
      mockInquirer.prompt.mockResolvedValue({ selection: 'project' });
      
      const results = await performFileSelection();
      
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
        .rejects.toThrow('Claude関連ファイルが見つかりませんでした');
    });
  });
});