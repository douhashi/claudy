import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { glob } from 'glob';
import {
  findClaudeFiles,
  findUserClaudeFiles,
  formatFilePath,
  selectFilesInteractively,
  performFileSelection,
} from '../../src/utils/file-selector';

// Mocks
jest.mock('glob');
jest.mock('fs-extra');
jest.mock('inquirer');
jest.mock('../../src/utils/logger');

const mockGlob = glob as jest.MockedFunction<typeof glob>;
const mockFs = fs as jest.Mocked<typeof fs> & {
  pathExists: jest.MockedFunction<(path: string) => Promise<boolean>>;
};
const mockInquirer = inquirer as jest.Mocked<typeof inquirer>;

describe('file-selector', () => {
  const testCwd = '/test/project';
  const homeDir = '/home/testuser';
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'cwd').mockReturnValue(testCwd);
    jest.spyOn(os, 'homedir').mockReturnValue(homeDir);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('findClaudeFiles', () => {
    it('should find all Claude-related files', async () => {
      mockGlob.mockImplementation(async (pattern) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        if (pattern === 'CLAUDE.local.md') return ['CLAUDE.local.md'];
        if (pattern === '.claude/**/*.md') return ['.claude/commands/test.md'];
        return [];
      });
      
      const files = await findClaudeFiles(testCwd);
      
      expect(files).toEqual([
        '.claude/commands/test.md',
        'CLAUDE.local.md',
        'CLAUDE.md'
      ]);
      expect(mockGlob).toHaveBeenCalledTimes(3);
    });
    
    it('should handle glob errors gracefully', async () => {
      mockGlob.mockImplementation(async (pattern) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        if (pattern === '.claude/**/*.md') throw new Error('Permission denied');
        return [];
      });
      
      const files = await findClaudeFiles(testCwd);
      
      expect(files).toEqual(['CLAUDE.md']);
    });
    
    it('should remove duplicates and sort files', async () => {
      mockGlob.mockImplementation(async () => ['CLAUDE.md', 'CLAUDE.md']);
      
      const files = await findClaudeFiles(testCwd);
      
      expect(files).toEqual(['CLAUDE.md']);
    });
  });
  
  describe('findUserClaudeFiles', () => {
    it('should find user-level Claude files', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockGlob.mockResolvedValue(['commands/custom.md', 'commands/another.md']);
      
      const result = await findUserClaudeFiles();
      
      expect(result).toEqual({
        files: [
          '.claude/CLAUDE.md',
          '.claude/commands/custom.md',
          '.claude/commands/another.md'
        ],
        baseDir: homeDir
      });
      expect(mockFs.pathExists).toHaveBeenCalledWith(path.join(homeDir, '.claude', 'CLAUDE.md'));
    });
    
    it('should handle missing user CLAUDE.md', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      mockGlob.mockResolvedValue(['commands/custom.md']);
      
      const result = await findUserClaudeFiles();
      
      expect(result).toEqual({
        files: ['.claude/commands/custom.md'],
        baseDir: homeDir
      });
    });
    
    it('should handle glob errors in user directory', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockGlob.mockRejectedValue(new Error('Permission denied'));
      
      const result = await findUserClaudeFiles();
      
      expect(result).toEqual({
        files: ['.claude/CLAUDE.md'],
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
    it('should create proper choices for interactive selection', async () => {
      const projectFiles = ['CLAUDE.md', '.claude/commands/test.md'];
      const userFiles = ['.claude/CLAUDE.md'];
      
      mockInquirer.prompt.mockResolvedValue({
        selectedFiles: ['project:CLAUDE.md', 'user:.claude/CLAUDE.md']
      });
      
      const results = await selectFilesInteractively(projectFiles, userFiles, homeDir);
      
      expect(mockInquirer.prompt).toHaveBeenCalledWith({
        type: 'checkbox',
        name: 'selectedFiles',
        message: '保存するファイルを選択してください (スペースで選択/解除):',
        choices: expect.arrayContaining([
          expect.objectContaining({ name: '--- プロジェクトレベル ---' }),
          expect.objectContaining({ name: './CLAUDE.md', value: 'project:CLAUDE.md' }),
          expect.objectContaining({ name: './.claude/commands/test.md', value: 'project:.claude/commands/test.md' }),
          expect.objectContaining({ name: '--- ユーザーレベル ---' }),
          expect.objectContaining({ name: '~/.claude/CLAUDE.md', value: 'user:.claude/CLAUDE.md' })
        ]),
        pageSize: 15,
        validate: expect.any(Function)
      });
      
      expect(results).toEqual([
        { files: ['CLAUDE.md'], baseDir: testCwd },
        { files: ['.claude/CLAUDE.md'], baseDir: homeDir }
      ]);
    });
    
    it('should handle empty file selection', async () => {
      mockInquirer.prompt.mockResolvedValue({ selectedFiles: [] });
      
      await expect(selectFilesInteractively([], [], homeDir))
        .rejects.toThrow('Claude関連ファイルが見つかりませんでした');
    });
    
    it('should validate at least one file is selected', async () => {
      const projectFiles = ['CLAUDE.md'];
      const userFiles: string[] = [];
      
      // @ts-expect-error - Mocking inquirer prompt for testing
      mockInquirer.prompt.mockImplementation(async (questions: unknown) => {
        const question = questions as { validate: (input: unknown) => boolean | string };
        const validateResult = question.validate([]);
        expect(validateResult).toBe('少なくとも1つのファイルを選択してください');
        
        return { selectedFiles: ['project:CLAUDE.md'] };
      });
      
      await selectFilesInteractively(projectFiles, userFiles, homeDir);
    });
  });
  
  describe('performFileSelection', () => {
    it('should perform complete file selection flow', async () => {
      // Mock findClaudeFiles
      mockGlob.mockImplementation(async (pattern) => {
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      
      // Mock findUserClaudeFiles
      mockFs.pathExists.mockResolvedValue(true);
      mockGlob.mockImplementation(async (pattern, options) => {
        if (options?.cwd === path.join(homeDir, '.claude')) {
          return ['commands/custom.md'];
        }
        if (pattern === 'CLAUDE.md') return ['CLAUDE.md'];
        return [];
      });
      
      // Mock selectFilesInteractively
      mockInquirer.prompt.mockResolvedValue({
        selectedFiles: ['project:CLAUDE.md']
      });
      
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