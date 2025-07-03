import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initI18n, t } from '../../src/utils/i18n.js';
import { logger } from '../../src/utils/logger.js';

describe('i18n message translation', () => {
  beforeAll(async () => {
    await initI18n();
  });

  describe('all translation keys resolve to actual messages', () => {
    it('should translate fileSelection messages correctly', () => {
      expect(t('common:fileSelection.searchingFiles')).toBe('Searching for Claude configuration files...');
      expect(t('common:fileSelection.howToSelect')).toBe('Select file selection method:');
      expect(t('common:fileSelection.bothFiles')).toBe('Both files (Project level + User level)');
      expect(t('common:fileSelection.projectOnly')).toBe('Project level files only');
      expect(t('common:fileSelection.userOnly')).toBe('User level files only');
      expect(t('common:fileSelection.customSelect')).toBe('Custom selection (select files individually)');
      expect(t('common:fileSelection.selectAllProject')).toBe('Select all project level files');
      expect(t('common:fileSelection.selectAllUser')).toBe('Select all user level files');
      expect(t('common:fileSelection.projectLevelSeparator')).toBe('--- Project level ---');
      expect(t('common:fileSelection.errorSelecting')).toBe('Error occurred while selecting files');
      expect(t('common:fileSelection.filesSelected', { count: 5 })).toBe('✓ 5 file(s) selected');
    });

    it('should translate path validation messages correctly', () => {
      expect(t('common:path.homeNotFound')).toBe('Home directory not found');
      expect(t('common:path.setNameRequired')).toBe('Set name is required');
      expect(t('common:path.invalidSetName')).toBe('Invalid set name');
      expect(t('common:path.emptyPartInName')).toBe('Set name contains empty parts');
      expect(t('common:path.invalidCharacters')).toBe('Set name contains invalid characters');
      expect(t('common:path.reservedWord', { part: 'test' })).toBe('"test" is a reserved word and cannot be used');
      expect(t('common:path.cannotStartWithDot')).toBe('Set name cannot start with a dot');
    });

    it('should translate error messages correctly', () => {
      expect(t('errors:operation.retryAfterError', { waitTime: 1000, attempt: 1, maxAttempts: 3 }))
        .toBe('An error occurred. Retrying in 1000ms... (1/3)');
      expect(t('errors:permission.fileAccessDenied', { path: ': /test/path' }))
        .toBe('Access denied to file or directory: /test/path');
      expect(t('errors:filesystem.diskFullWithPath', { path: ': /test/path' }))
        .toBe('Insufficient disk space: /test/path');
      expect(t('errors:resource.setNotFoundDetail', { setName: 'test-set' }))
        .toBe('Set "test-set" not found. Use \'claudy list\' to check available sets.');
    });

    it('should translate solution headers correctly', () => {
      expect(t('errors:solutionHeader')).toBe('Solutions');
      const permissionSolutions = t('errors:solutions.permissionDenied', { returnObjects: true }) as string[];
      expect(Array.isArray(permissionSolutions)).toBe(true);
      expect(permissionSolutions).toContain('Check the permissions of the file or directory');
      
      const diskSolutions = t('errors:solutions.diskFull', { returnObjects: true }) as string[];
      expect(Array.isArray(diskSolutions)).toBe(true);
      expect(diskSolutions).toContain('Check available disk space');
    });

    it('should translate config messages correctly', () => {
      expect(t('common:config.initialized')).toBe('claudy configuration initialized (XDG Base Directory compliant)');
    });

    it('should translate debug messages correctly', () => {
      expect(t('common:debug.directorySecured', { dirPath: '/test/path' })).toBe('Directory created: /test/path');
      expect(t('common:debug.fileRead', { filePath: '/test/file.txt' })).toBe('File read: /test/file.txt');
      expect(t('common:debug.fileWritten', { filePath: '/test/file.txt' })).toBe('File written: /test/file.txt');
      expect(t('common:debug.fileCopied', { src: '/src/file', dest: '/dest/file' })).toBe('File copied: /src/file → /dest/file');
      expect(t('common:debug.fileDeleted', { filePath: '/test/file.txt' })).toBe('File deleted: /test/file.txt');
      expect(t('common:debug.directoryCopied', { src: '/src/dir', dest: '/dest/dir' })).toBe('Directory copied: /src/dir → /dest/dir');
    });
  });

  describe('no hardcoded messages in logger calls', () => {
    it('should not output translation keys directly', () => {
      // Mock logger methods to capture output
      const loggerSpy = {
        info: vi.spyOn(logger, 'info'),
        error: vi.spyOn(logger, 'error'),
        warn: vi.spyOn(logger, 'warn'),
        success: vi.spyOn(logger, 'success'),
        debug: vi.spyOn(logger, 'debug')
      };

      // Test common translation patterns
      logger.info(t('common:fileSelection.searchingFiles'));
      logger.error(t('errors:operation.saveError'));
      logger.warn(t('errors:operation.retryAfterError', { waitTime: 1000, attempt: 1, maxAttempts: 3 }));
      logger.success(t('common:config.initialized'));
      logger.debug(t('common:debug.fileRead', { filePath: '/test' }));

      // Verify that no call contains just the translation key
      expect(loggerSpy.info).toHaveBeenCalledWith('Searching for Claude configuration files...');
      expect(loggerSpy.error).toHaveBeenCalledWith('Failed to save the set.');
      expect(loggerSpy.warn).toHaveBeenCalledWith('An error occurred. Retrying in 1000ms... (1/3)');
      expect(loggerSpy.success).toHaveBeenCalledWith('claudy configuration initialized (XDG Base Directory compliant)');
      expect(loggerSpy.debug).toHaveBeenCalledWith('File read: /test');

      // Verify no call contains namespace prefix
      for (const spy of Object.values(loggerSpy)) {
        spy.mock.calls.forEach(call => {
          expect(call[0]).not.toMatch(/^(common|commands|errors):/);
        });
      }

      // Restore spies
      Object.values(loggerSpy).forEach(spy => spy.mockRestore());
    });
  });
});