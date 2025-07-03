import { describe, it, expect, beforeAll } from 'vitest';
import { initI18n, t } from '../../src/utils/i18n.js';

describe('i18n', () => {
  beforeAll(async () => {
    await initI18n();
  });

  describe('initI18n', () => {
    it('should initialize i18n successfully', async () => {
      // Already initialized in beforeAll, but test it doesn't throw
      await expect(initI18n()).resolves.toBeUndefined();
    });
  });

  describe('t (translation function)', () => {
    it('should translate common messages', () => {
      expect(t('common:app.name')).toBe('claudy');
      expect(t('common:app.unexpectedError')).toBe('An unexpected error occurred');
    });

    it('should translate command messages', () => {
      expect(t('commands:save.description')).toBe('Save the current CLAUDE.md and command settings');
      expect(t('commands:load.description')).toBe('Restore a saved configuration to the current directory');
      expect(t('commands:list.description')).toBe('List saved sets');
      expect(t('commands:delete.description')).toBe('Delete a saved set');
    });

    it('should translate error messages', () => {
      expect(t('errors:validation.invalidSetName')).toBe('Invalid set name. Only alphanumeric characters, hyphens, and underscores are allowed.');
      expect(t('errors:resource.setNotFound')).toBe('The specified set was not found.');
      expect(t('errors:permission.denied')).toBe('Access denied.');
    });

    it('should handle interpolation', () => {
      expect(t('commands:save.messages.filesFound', { count: 5 })).toBe('Found 5 file(s)');
      expect(t('commands:save.messages.success', { name: 'test-set' })).toBe('Successfully saved set \'test-set\'');
    });

    it('should return arrays for solutions', () => {
      const solutions = t('errors:solutions.permissionDenied', { returnObjects: true });
      expect(Array.isArray(solutions)).toBe(true);
      expect(solutions).toHaveLength(3);
    });

    it('should fallback to key if translation not found', () => {
      const nonExistentKey = 'non.existent.key';
      expect(t(nonExistentKey)).toBe(nonExistentKey);
    });
  });
});