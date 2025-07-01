import { describe, it, expect } from 'vitest';
import * as path from '../../src/utils/path';
import os from 'os';

describe('path utils', () => {
  describe('getHomeDir', () => {
    it('should return home directory', () => {
      const homeDir = path.getHomeDir();
      expect(homeDir).toBe(os.homedir());
    });
  });

  describe('getClaudyDir', () => {
    it('should return .claudy directory path', () => {
      const claudyDir = path.getClaudyDir();
      expect(claudyDir).toBe(`${os.homedir()}/.claudy`);
    });
  });

  describe('resolvePath', () => {
    it('should resolve ~ to home directory', () => {
      const resolved = path.resolvePath('~/test');
      expect(resolved).toBe(`${os.homedir()}/test`);
    });

    it('should resolve relative path to absolute', () => {
      const resolved = path.resolvePath('./test');
      expect(resolved).toContain('/test');
    });
  });
});