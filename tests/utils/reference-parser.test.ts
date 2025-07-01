import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import {
  extractFileReferences,
  resolveReferencePath,
  collectReferences,
  ReferencedFile
} from '../../src/utils/reference-parser';

jest.mock('fs-extra');
jest.mock('../../src/utils/logger');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('reference-parser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractFileReferences', () => {
    it('should extract simple @ references', () => {
      const content = 'Check @docs/guide.md for details';
      const references = extractFileReferences(content);
      expect(references).toEqual(['docs/guide.md']);
    });

    it('should extract references in parentheses', () => {
      const content = 'See documentation (@docs/api.md)';
      const references = extractFileReferences(content);
      expect(references).toEqual(['docs/api.md']);
    });

    it('should extract multiple references', () => {
      const content = `
        Main guide: @docs/guide.md
        API docs: @docs/api.md
        Examples: @examples/sample.ts
      `;
      const references = extractFileReferences(content);
      expect(references).toEqual(['docs/guide.md', 'docs/api.md', 'examples/sample.ts']);
    });

    it('should not extract duplicate references', () => {
      const content = `
        First: @docs/guide.md
        Second: @docs/guide.md
      `;
      const references = extractFileReferences(content);
      expect(references).toEqual(['docs/guide.md']);
    });

    it('should return empty array when no references found', () => {
      const content = 'No references here';
      const references = extractFileReferences(content);
      expect(references).toEqual([]);
    });
  });

  describe('resolveReferencePath', () => {
    it('should resolve relative path from source file directory', async () => {
      const referencePath = '../docs/guide.md';
      const baseDir = '/project';
      const sourceFilePath = 'src/index.md';
      
      mockFs.pathExists.mockResolvedValue(true);
      
      const resolved = await resolveReferencePath(referencePath, baseDir, sourceFilePath);
      expect(resolved).toBe('docs/guide.md');
    });

    it('should handle absolute paths', async () => {
      const referencePath = '/absolute/path/to/file.md';
      const baseDir = '/project';
      const sourceFilePath = 'src/index.md';
      
      mockFs.pathExists.mockResolvedValue(true);
      
      // Since the absolute path is outside baseDir, it should return a relative path
      const resolved = await resolveReferencePath(referencePath, baseDir, sourceFilePath);
      expect(resolved).toBe('../absolute/path/to/file.md');
    });

    it('should return null for non-existent files', async () => {
      const referencePath = 'does-not-exist.md';
      const baseDir = '/project';
      const sourceFilePath = 'src/index.md';
      
      mockFs.pathExists.mockResolvedValue(false);
      
      const resolved = await resolveReferencePath(referencePath, baseDir, sourceFilePath);
      expect(resolved).toBeNull();
    });

    it('should resolve path from same directory', async () => {
      const referencePath = 'guide.md';
      const baseDir = '/project';
      const sourceFilePath = 'docs/index.md';
      
      mockFs.pathExists.mockResolvedValue(true);
      
      const resolved = await resolveReferencePath(referencePath, baseDir, sourceFilePath);
      expect(resolved).toBe('docs/guide.md');
    });
  });

  describe('collectReferences', () => {
    it('should collect references from a single file', async () => {
      const filePath = 'index.md';
      const baseDir = '/project';
      const fileContent = 'See @docs/guide.md';
      
      mockFs.readFile.mockResolvedValue(fileContent);
      mockFs.pathExists.mockResolvedValue(true);
      
      const references = await collectReferences(filePath, baseDir);
      
      expect(references).toEqual([
        {
          path: 'docs/guide.md',
          referredFrom: ['index.md']
        }
      ]);
    });

    it('should handle nested references', async () => {
      const baseDir = '/project';
      
      // Mock file contents
      mockFs.readFile.mockImplementation((path) => {
        const filePath = path.toString();
        if (filePath.endsWith('index.md')) {
          return Promise.resolve('See @docs/guide.md');
        } else if (filePath.endsWith('guide.md')) {
          return Promise.resolve('Also check @docs/api.md');
        } else {
          return Promise.resolve('');
        }
      });
      
      mockFs.pathExists.mockResolvedValue(true);
      
      const references = await collectReferences('index.md', baseDir);
      
      expect(references).toHaveLength(2);
      expect(references).toContainEqual({
        path: 'docs/guide.md',
        referredFrom: ['index.md']
      });
      expect(references).toContainEqual({
        path: 'docs/api.md',
        referredFrom: ['docs/guide.md']
      });
    });

    it('should prevent circular references', async () => {
      const baseDir = '/project';
      const processedFiles = new Set<string>();
      processedFiles.add(path.normalize('file1.md'));
      
      mockFs.readFile.mockResolvedValue('See @file1.md');
      mockFs.pathExists.mockResolvedValue(true);
      
      const references = await collectReferences('file2.md', baseDir, processedFiles);
      
      // Should not process file1.md again
      expect(references).toEqual([]);
    });

    it('should respect depth limit', async () => {
      const baseDir = '/project';
      
      mockFs.readFile.mockResolvedValue('See @deep/nested.md');
      mockFs.pathExists.mockResolvedValue(true);
      
      const references = await collectReferences('index.md', baseDir, new Set(), 2, 2);
      
      // Should return empty due to depth limit
      expect(references).toEqual([]);
    });

    it('should merge duplicate references from different sources', async () => {
      const baseDir = '/project';
      
      mockFs.readFile.mockImplementation((path) => {
        const filePath = path.toString();
        if (filePath.endsWith('index.md')) {
          return Promise.resolve('See @docs/api.md and @src/file.md');
        } else if (filePath.endsWith('file.md')) {
          return Promise.resolve('Also see @docs/api.md');
        } else {
          return Promise.resolve('');
        }
      });
      
      mockFs.pathExists.mockResolvedValue(true);
      
      const references = await collectReferences('index.md', baseDir);
      
      // docs/api.md should have both sources
      const apiRef = references.find(r => r.path === 'docs/api.md');
      expect(apiRef).toBeDefined();
      expect(apiRef!.referredFrom).toContain('index.md');
      expect(apiRef!.referredFrom).toContain('src/file.md');
    });

    it('should handle file read errors gracefully', async () => {
      const baseDir = '/project';
      
      mockFs.readFile.mockRejectedValue(new Error('File read error'));
      
      const references = await collectReferences('index.md', baseDir);
      
      expect(references).toEqual([]);
    });
  });
});