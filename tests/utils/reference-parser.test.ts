import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  extractFileReferences,
  resolveReferencePath,
  collectReferences,
  ReferencedFile
} from '../../src/utils/reference-parser';

vi.mock('fs-extra');
vi.mock('../../src/utils/logger');

const mockFs = fs as any;

describe('reference-parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      
      vi.mocked(mockFs.pathExists).mockResolvedValue(true);
      
      const resolved = await resolveReferencePath(referencePath, baseDir, sourceFilePath);
      expect(resolved).toBe('docs/guide.md');
    });

    it('should handle absolute paths', async () => {
      const referencePath = '/absolute/path/to/file.md';
      const baseDir = '/project';
      const sourceFilePath = 'src/index.md';
      
      vi.mocked(mockFs.pathExists).mockResolvedValue(true);
      
      // Since the absolute path is outside baseDir, it should return a relative path
      const resolved = await resolveReferencePath(referencePath, baseDir, sourceFilePath);
      expect(resolved).toBe('../absolute/path/to/file.md');
    });

    it('should return null for non-existent files', async () => {
      const referencePath = 'does-not-exist.md';
      const baseDir = '/project';
      const sourceFilePath = 'src/index.md';
      
      vi.mocked(mockFs.pathExists).mockResolvedValue(false);
      
      const resolved = await resolveReferencePath(referencePath, baseDir, sourceFilePath);
      expect(resolved).toBeNull();
    });

    it('should resolve path from same directory', async () => {
      const referencePath = 'guide.md';
      const baseDir = '/project';
      const sourceFilePath = 'docs/index.md';
      
      vi.mocked(mockFs.pathExists).mockResolvedValue(true);
      
      const resolved = await resolveReferencePath(referencePath, baseDir, sourceFilePath);
      expect(resolved).toBe('docs/guide.md');
    });
  });

  describe('collectReferences', () => {
    it('should collect references from a single file', async () => {
      const filePath = 'index.md';
      const baseDir = '/project';
      const fileContent = 'See @docs/guide.md';
      
      vi.mocked(mockFs.readFile).mockImplementation((path) => {
        if (path.toString().endsWith('index.md')) {
          return Promise.resolve(fileContent);
        }
        return Promise.resolve('');
      });
      vi.mocked(mockFs.pathExists).mockResolvedValue(true);
      
      const references = await collectReferences(filePath, baseDir);
      
      // Filter out nested references for this test
      const directReferences = references.filter(ref => ref.referredFrom.includes('index.md'));
      
      expect(directReferences).toEqual([
        {
          path: 'docs/guide.md',
          referredFrom: ['index.md']
        }
      ]);
    });

    it('should handle nested references', async () => {
      const baseDir = '/project';
      
      // Mock file contents
      vi.mocked(mockFs.readFile).mockImplementation((path) => {
        const filePath = path.toString();
        if (filePath.endsWith('index.md')) {
          return Promise.resolve('See @docs/guide.md');
        } else if (filePath.endsWith('guide.md')) {
          return Promise.resolve('Also check @api.md');
        } else {
          return Promise.resolve('');
        }
      });
      
      vi.mocked(mockFs.pathExists).mockResolvedValue(true);
      
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
      
      vi.mocked(mockFs.readFile).mockImplementation((path) => {
        const filePath = path.toString();
        if (filePath.endsWith('file1.md')) {
          return Promise.resolve('See @file2.md');
        } else if (filePath.endsWith('file2.md')) {
          return Promise.resolve('See @file1.md');
        }
        return Promise.resolve('');
      });
      vi.mocked(mockFs.pathExists).mockResolvedValue(true);
      
      const references = await collectReferences('file1.md', baseDir);
      
      // Should contain file2.md but not file1.md again
      expect(references.map(r => r.path)).toContain('file2.md');
      expect(references.filter(r => r.path === 'file1.md')).toHaveLength(1);
    });

    it('should respect depth limit', async () => {
      const baseDir = '/project';
      
      vi.mocked(mockFs.readFile).mockResolvedValue('See @deep/nested.md');
      vi.mocked(mockFs.pathExists).mockResolvedValue(true);
      
      const references = await collectReferences('index.md', baseDir, new Set(), 2, 2);
      
      // Should return empty due to depth limit
      expect(references).toEqual([]);
    });

    it('should merge duplicate references from different sources', async () => {
      const baseDir = '/project';
      
      vi.mocked(mockFs.readFile).mockImplementation((path) => {
        const filePath = path.toString();
        if (filePath.endsWith('index.md')) {
          return Promise.resolve('See @docs/api.md and @src/file.md');
        } else if (filePath.endsWith('src/file.md')) {
          return Promise.resolve('Also see @../docs/api.md');
        } else {
          return Promise.resolve('');
        }
      });
      
      vi.mocked(mockFs.pathExists).mockResolvedValue(true);
      
      const references = await collectReferences('index.md', baseDir);
      
      // docs/api.md should have both sources
      const apiRef = references.find(r => r.path === 'docs/api.md');
      expect(apiRef).toBeDefined();
      expect(apiRef!.referredFrom.sort()).toEqual(['index.md', 'src/file.md'].sort());
    });

    it('should handle file read errors gracefully', async () => {
      const baseDir = '/project';
      
      vi.mocked(mockFs.readFile).mockRejectedValue(new Error('File read error'));
      
      const references = await collectReferences('index.md', baseDir);
      
      expect(references).toEqual([]);
    });
  });
});