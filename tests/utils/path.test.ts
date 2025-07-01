import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from '../../src/utils/path';
import os from 'os';
import nodePath from 'path';

describe('path utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getHomeDir', () => {
    it('should return home directory', () => {
      const homeDir = path.getHomeDir();
      expect(homeDir).toBe(os.homedir());
    });
  });

  describe('getConfigDir', () => {
    it('should return XDG config directory when XDG_CONFIG_HOME is not set', () => {
      delete process.env.XDG_CONFIG_HOME;
      const configDir = path.getConfigDir();
      expect(configDir).toBe(nodePath.join(os.homedir(), '.config', 'claudy'));
    });

    it('should use XDG_CONFIG_HOME when set', () => {
      process.env.XDG_CONFIG_HOME = '/custom/config';
      const configDir = path.getConfigDir();
      expect(configDir).toBe('/custom/config/claudy');
    });
  });

  describe('getClaudyDir', () => {
    it('should return XDG compliant directory path', () => {
      delete process.env.XDG_CONFIG_HOME;
      const claudyDir = path.getClaudyDir();
      expect(claudyDir).toBe(nodePath.join(os.homedir(), '.config', 'claudy'));
    });
  });

  describe('getLegacyClaudyDir', () => {
    it('should return legacy .claudy directory path', () => {
      const legacyDir = path.getLegacyClaudyDir();
      expect(legacyDir).toBe(nodePath.join(os.homedir(), '.claudy'));
    });
  });

  describe('getUserConfigDir', () => {
    it('should return user config directory path', () => {
      delete process.env.XDG_CONFIG_HOME;
      const userConfigDir = path.getUserConfigDir();
      expect(userConfigDir).toBe(
        nodePath.join(os.homedir(), '.config', 'claudy', 'profiles', 'default', 'user')
      );
    });
  });

  describe('getProjectsDir', () => {
    it('should return projects directory path', () => {
      delete process.env.XDG_CONFIG_HOME;
      const projectsDir = path.getProjectsDir();
      expect(projectsDir).toBe(nodePath.join(os.homedir(), '.config', 'claudy', 'projects'));
    });
  });

  describe('getProjectHash', () => {
    it('should generate consistent hash for the same path', () => {
      const projectPath = '/home/user/project';
      const hash1 = path.getProjectHash(projectPath);
      const hash2 = path.getProjectHash(projectPath);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(12);
    });

    it('should generate different hashes for different paths', () => {
      const hash1 = path.getProjectHash('/home/user/project1');
      const hash2 = path.getProjectHash('/home/user/project2');
      expect(hash1).not.toBe(hash2);
    });

    it('should normalize paths before hashing', () => {
      const hash1 = path.getProjectHash('/home/user/project');
      const hash2 = path.getProjectHash('/home/user/project/');
      const hash3 = path.getProjectHash('/home/user/../user/project');
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });
  });

  describe('getProjectConfigDir', () => {
    it('should return project-specific config directory', () => {
      delete process.env.XDG_CONFIG_HOME;
      const projectPath = '/home/user/project';
      const projectConfigDir = path.getProjectConfigDir(projectPath);
      const expectedHash = path.getProjectHash(projectPath);
      expect(projectConfigDir).toBe(
        nodePath.join(os.homedir(), '.config', 'claudy', 'projects', expectedHash)
      );
    });
  });

  describe('resolvePath', () => {
    it('should resolve ~ to home directory', () => {
      const resolved = path.resolvePath('~/test');
      expect(resolved).toBe(nodePath.join(os.homedir(), 'test'));
    });

    it('should resolve relative path to absolute', () => {
      const resolved = path.resolvePath('./test');
      expect(resolved).toContain('/test');
    });
  });

  describe('normalizePathSeparators', () => {
    it('should normalize path separators to forward slashes', () => {
      const normalized = path.normalizePathSeparators('path\\to\\file');
      expect(normalized).toBe('path/to/file');
    });
  });

  describe('getSetsDir', () => {
    it('should return sets directory path', () => {
      delete process.env.XDG_CONFIG_HOME;
      const setsDir = path.getSetsDir();
      expect(setsDir).toBe(nodePath.join(os.homedir(), '.config', 'claudy', 'sets'));
    });
  });

  describe('getSetDir', () => {
    it('should return set directory path for simple name', () => {
      delete process.env.XDG_CONFIG_HOME;
      const setDir = path.getSetDir('myproject');
      expect(setDir).toBe(nodePath.join(os.homedir(), '.config', 'claudy', 'sets', 'myproject'));
    });

    it('should return set directory path for hierarchical name', () => {
      delete process.env.XDG_CONFIG_HOME;
      const setDir = path.getSetDir('node/express');
      expect(setDir).toBe(nodePath.join(os.homedir(), '.config', 'claudy', 'sets', 'node', 'express'));
    });

    it('should throw error for empty set name', () => {
      expect(() => path.getSetDir('')).toThrow('セット名を指定してください');
    });

    it('should throw error for path traversal attempts', () => {
      expect(() => path.getSetDir('../etc')).toThrow('無効なセット名です');
      expect(() => path.getSetDir('test/../../../etc')).toThrow('無効なセット名です');
    });
  });

  describe('validateSetName', () => {
    it('should accept valid set names', () => {
      expect(() => path.validateSetName('myproject')).not.toThrow();
      expect(() => path.validateSetName('my-project')).not.toThrow();
      expect(() => path.validateSetName('my_project')).not.toThrow();
      expect(() => path.validateSetName('node/express')).not.toThrow();
      expect(() => path.validateSetName('python/django/webapp')).not.toThrow();
    });

    it('should reject empty set names', () => {
      expect(() => path.validateSetName('')).toThrow('セット名を指定してください');
      expect(() => path.validateSetName('  ')).toThrow('セット名を指定してください');
    });

    it('should reject set names with path traversal', () => {
      expect(() => path.validateSetName('../etc')).toThrow('無効なセット名です');
      expect(() => path.validateSetName('test/../../../etc')).toThrow('無効なセット名です');
      expect(() => path.validateSetName('/absolute/path')).toThrow('無効なセット名です');
    });

    it('should reject set names with invalid characters', () => {
      expect(() => path.validateSetName('test:name')).toThrow('セット名に使用できない文字が含まれています');
      expect(() => path.validateSetName('test*name')).toThrow('セット名に使用できない文字が含まれています');
      expect(() => path.validateSetName('test?name')).toThrow('セット名に使用できない文字が含まれています');
      expect(() => path.validateSetName('test<name')).toThrow('セット名に使用できない文字が含まれています');
      expect(() => path.validateSetName('test>name')).toThrow('セット名に使用できない文字が含まれています');
      expect(() => path.validateSetName('test|name')).toThrow('セット名に使用できない文字が含まれています');
      expect(() => path.validateSetName('test"name')).toThrow('セット名に使用できない文字が含まれています');
    });

    it('should reject reserved names', () => {
      expect(() => path.validateSetName('CON')).toThrow('"CON"は予約語のため使用できません');
      expect(() => path.validateSetName('PRN')).toThrow('"PRN"は予約語のため使用できません');
      expect(() => path.validateSetName('profiles')).toThrow('"profiles"は予約語のため使用できません');
    });

    it('should reject set names starting with dot', () => {
      expect(() => path.validateSetName('.hidden')).toThrow('セット名はドットで始めることはできません');
      expect(() => path.validateSetName('test/.hidden')).toThrow('セット名はドットで始めることはできません');
    });

    it('should reject set names with empty parts', () => {
      expect(() => path.validateSetName('test//name')).toThrow('セット名に空のパートが含まれています');
      expect(() => path.validateSetName('test/')).toThrow('セット名に空のパートが含まれています');
      expect(() => path.validateSetName('/test')).toThrow('無効なセット名です'); // Absolute path
    });
  });
});