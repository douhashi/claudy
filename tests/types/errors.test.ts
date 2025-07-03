import { describe, it, expect, beforeAll } from 'vitest';
import { 
  ErrorCodes, 
  ErrorMessages,
  ErrorSolutions,
  getErrorMessage, 
  getErrorSolutions,
  mapSystemErrorCode, 
  formatErrorMessage,
  wrapError 
} from '../../src/types/errors.js';
import { ClaudyError } from '../../src/types/index.js';
import { initI18n } from '../../src/utils/i18n.js';

describe('errors', () => {
  beforeAll(async () => {
    await initI18n();
  });

  describe('getErrorMessage', () => {
    it('should return correct error messages for each error code', () => {
      expect(getErrorMessage(ErrorCodes.INVALID_SET_NAME)).toBe(
        'Invalid set name. Only alphanumeric characters, hyphens, and underscores are allowed.'
      );
      expect(getErrorMessage(ErrorCodes.FILE_NOT_FOUND)).toBe('File not found.');
      expect(getErrorMessage(ErrorCodes.PERMISSION_DENIED)).toBe('Access denied.');
    });

    it('should fallback to unknown error for invalid codes', () => {
      expect(getErrorMessage('INVALID_CODE' as any)).toBe('An unknown error occurred.');
    });
  });

  describe('getErrorSolutions', () => {
    it('should return solutions for supported error codes', () => {
      const permissionSolutions = getErrorSolutions(ErrorCodes.PERMISSION_DENIED);
      expect(Array.isArray(permissionSolutions)).toBe(true);
      expect(permissionSolutions).toHaveLength(3);
      expect(permissionSolutions[0]).toContain('Check the permissions');
    });

    it('should return empty array for unsupported error codes', () => {
      const solutions = getErrorSolutions(ErrorCodes.INTERNAL_ERROR);
      expect(Array.isArray(solutions)).toBe(true);
      expect(solutions).toHaveLength(0);
    });
  });

  describe('mapSystemErrorCode', () => {
    it('should map system error codes correctly', () => {
      expect(mapSystemErrorCode('EACCES')).toBe(ErrorCodes.PERMISSION_DENIED);
      expect(mapSystemErrorCode('EPERM')).toBe(ErrorCodes.PERMISSION_DENIED);
      expect(mapSystemErrorCode('ENOENT')).toBe(ErrorCodes.FILE_NOT_FOUND);
      expect(mapSystemErrorCode('ENOSPC')).toBe(ErrorCodes.DISK_FULL);
      expect(mapSystemErrorCode('EEXIST')).toBe(ErrorCodes.PROFILE_EXISTS);
    });

    it('should return UNKNOWN_ERROR for unknown codes', () => {
      expect(mapSystemErrorCode('UNKNOWN_CODE')).toBe(ErrorCodes.UNKNOWN_ERROR);
      expect(mapSystemErrorCode(undefined)).toBe(ErrorCodes.UNKNOWN_ERROR);
    });
  });

  describe('formatErrorMessage', () => {
    it('should format ClaudyError messages correctly', () => {
      const error = new ClaudyError('Test error', ErrorCodes.PERMISSION_DENIED);
      const formatted = formatErrorMessage(error, false, false);
      expect(formatted).toBe('Test error');
    });

    it('should include details when requested', () => {
      const error = new ClaudyError('Test error', ErrorCodes.FILE_NOT_FOUND, { path: '/test/path' });
      const formatted = formatErrorMessage(error, true, false);
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('Details:');
      expect(formatted).toContain('/test/path');
    });

    it('should include solutions when requested', () => {
      const error = new ClaudyError('Test error', ErrorCodes.PERMISSION_DENIED);
      const formatted = formatErrorMessage(error, false, true);
      expect(formatted).toContain('Solutions:');
      expect(formatted).toContain('Check the permissions');
    });

    it('should handle regular Error objects', () => {
      const error = new Error('Regular error');
      const formatted = formatErrorMessage(error);
      expect(formatted).toBe('Regular error');
    });
  });

  describe('wrapError', () => {
    it('should wrap system errors correctly', () => {
      const systemError = new Error('System error') as NodeJS.ErrnoException;
      systemError.code = 'ENOENT';
      systemError.path = '/test/path';

      const wrapped = wrapError(systemError, ErrorCodes.FILE_READ_ERROR);
      expect(wrapped).toBeInstanceOf(ClaudyError);
      expect(wrapped.code).toBe(ErrorCodes.FILE_READ_ERROR);
      expect(wrapped.message).toBe('File not found. (/test/path)');
      expect(wrapped.details).toHaveProperty('systemCode', 'ENOENT');
    });

    it('should use custom message when provided', () => {
      const error = new Error('Original error');
      const wrapped = wrapError(error, ErrorCodes.SAVE_ERROR, 'Custom error message');
      expect(wrapped.message).toBe('Custom error message');
    });

    it('should return ClaudyError as-is', () => {
      const claudyError = new ClaudyError('Existing error', ErrorCodes.LOAD_ERROR);
      const wrapped = wrapError(claudyError, ErrorCodes.SAVE_ERROR);
      expect(wrapped).toBe(claudyError);
    });

    it('should handle non-Error objects', () => {
      const wrapped = wrapError('String error', ErrorCodes.UNKNOWN_ERROR);
      expect(wrapped.details).toHaveProperty('originalError', 'String error');
    });
  });

  describe('ErrorMessages proxy (backward compatibility)', () => {
    it('should provide access to error messages through proxy', () => {
      expect(ErrorMessages[ErrorCodes.INVALID_SET_NAME]).toBe(
        'Invalid set name. Only alphanumeric characters, hyphens, and underscores are allowed.'
      );
      expect(ErrorMessages[ErrorCodes.FILE_NOT_FOUND]).toBe('File not found.');
    });
  });

  describe('ErrorSolutions proxy (backward compatibility)', () => {
    it('should provide access to error solutions through proxy', () => {
      const solutions = ErrorSolutions[ErrorCodes.PERMISSION_DENIED];
      expect(Array.isArray(solutions)).toBe(true);
      expect(solutions).toHaveLength(3);
    });
  });
});