import { initI18n } from '../../src/utils/i18n.js';

let isInitialized = false;

/**
 * Initialize i18n for tests
 */
export async function setupI18n(): Promise<void> {
  if (!isInitialized) {
    await initI18n();
    isInitialized = true;
  }
}

/**
 * Check if a message contains a key phrase (case-insensitive)
 */
export function containsPhrase(message: string, phrase: string): boolean {
  return message.toLowerCase().includes(phrase.toLowerCase());
}

/**
 * Check if any call to a mock function contains a phrase
 */
export function anyCallContains(mockFn: any, phrase: string): boolean {
  if (!mockFn.mock || !mockFn.mock.calls) return false;
  return mockFn.mock.calls.some((call: any[]) => 
    call.some(arg => typeof arg === 'string' && containsPhrase(arg, phrase))
  );
}

/**
 * Get all string arguments from mock calls
 */
export function getAllStringArgs(mockFn: any): string[] {
  if (!mockFn.mock || !mockFn.mock.calls) return [];
  return mockFn.mock.calls
    .flat()
    .filter((arg: any) => typeof arg === 'string');
}

/**
 * Assertion helpers for i18n tests
 */
export const i18nAssert = {
  /**
   * Assert that a mock function was called with a message containing a phrase
   */
  calledWithPhrase(mockFn: any, phrase: string): void {
    const allArgs = getAllStringArgs(mockFn);
    const found = allArgs.some(arg => containsPhrase(arg, phrase));
    if (!found) {
      throw new Error(
        `Expected mock to be called with phrase "${phrase}", but it was not found.\n` +
        `Actual calls: ${JSON.stringify(allArgs, null, 2)}`
      );
    }
  },

  /**
   * Assert that an error contains expected properties without checking exact message
   */
  errorMatches(error: any, expectedCode: string, expectedDetails?: any): void {
    expect(error).toBeInstanceOf(Error);
    if ('code' in error) {
      expect(error.code).toBe(expectedCode);
    }
    if (expectedDetails && 'details' in error) {
      expect(error.details).toMatchObject(expectedDetails);
    }
  }
};