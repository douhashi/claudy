import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fsExtra from 'fs-extra';
const fs = fsExtra;
import os from 'os';

describe('CLI output does not contain translation keys', () => {
  let tempDir: string;
  let originalCwd: string;
  const setName = 'test-cli-output';

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claudy-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Create test files
    await fs.writeFile('CLAUDE.md', '# Test CLAUDE.md file');
    await fs.ensureDir('.claude/commands');
    await fs.writeFile('.claude/commands/test.md', '# Test command');
  });

  afterEach(async () => {
    // Restore original directory
    process.chdir(originalCwd);
    
    // Clean up temp directory
    await fs.remove(tempDir);

    // Clean up saved set if it exists
    const homeDir = os.homedir();
    const setPath = path.join(homeDir, '.config', 'claudy', 'sets', setName);
    if (await fs.pathExists(setPath)) {
      await fs.remove(setPath);
    }
  });

  const runCommand = (cmd: string): string => {
    try {
      const binPath = path.join(originalCwd, 'bin', 'claudy');
      return execSync(`node ${binPath} ${cmd}`, {
        encoding: 'utf-8',
        env: { ...process.env, NODE_ENV: 'test' }
      });
    } catch (error: any) {
      // Combine both stdout and stderr for error cases
      return (error.stdout || '') + (error.stderr || '');
    }
  };

  it('should display English messages in save command with -a flag', () => {
    const output = runCommand(`save ${setName} -a -f`);

    // Check that output contains English messages
    expect(output).toContain('Searching for Claude configuration files...');
    expect(output).toContain('file(s)');
    expect(output).toContain('Saving files...');
    expect(output).toContain(`Set name: "${setName}"`);
    expect(output).toContain('Save path:');

    // Check that output does NOT contain translation keys
    expect(output).not.toMatch(/fileSelection\.searchingFiles/);
    expect(output).not.toMatch(/save\.messages\./);
    expect(output).not.toMatch(/common:/);
    expect(output).not.toMatch(/commands:/);
    expect(output).not.toMatch(/errors:/);
  });

  it('should display English messages when no files are found', async () => {
    // Remove test files
    await fs.remove('CLAUDE.md');
    await fs.remove('.claude');

    const output = runCommand(`save ${setName} -a`);

    // Check for English error message
    expect(output).toContain('No files to save were found');

    // Check that output does NOT contain translation keys
    expect(output).not.toMatch(/resource\.noFilesFound/);
    expect(output).not.toMatch(/errors:/);
    
    // Also check that searching message is in English
    expect(output).toContain('Searching for Claude configuration files...');
  });

  it('should display English messages in list command', () => {
    // First save a set
    runCommand(`save ${setName} -a -f`);

    const output = runCommand('list');

    // Check that output contains English messages
    expect(output).toContain('Set Name');
    expect(output).toContain(setName);

    // Check that output does NOT contain translation keys
    expect(output).not.toMatch(/list\.messages\./);
    expect(output).not.toMatch(/commands:/);
  });

  it('should display English messages in delete command', () => {
    // First save a set
    runCommand(`save ${setName} -a -f`);

    const output = runCommand(`delete ${setName} -f`);

    // Check that output contains English messages
    expect(output).toContain(`Deleting set '${setName}'...`);
    expect(output).toContain(`Successfully deleted set '${setName}'`);

    // Check that output does NOT contain translation keys
    expect(output).not.toMatch(/delete\.messages\./);
    expect(output).not.toMatch(/commands:/);
  });

  it('should display English error messages for invalid set names', () => {
    const output = runCommand('save "../invalid" -a');

    // Check for English validation message
    expect(output).toContain('Invalid set name');

    // Check that output does NOT contain translation keys
    expect(output).not.toMatch(/validation\.invalidName/);
    expect(output).not.toMatch(/path\./);
    expect(output).not.toMatch(/common:/);
  });
});