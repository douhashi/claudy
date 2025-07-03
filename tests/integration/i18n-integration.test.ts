import { describe, it, expect, beforeAll } from 'vitest';
import { Command } from 'commander';
import { registerSaveCommand } from '../../src/commands/save.js';
import { registerLoadCommand } from '../../src/commands/load.js';
import { registerListCommand } from '../../src/commands/list.js';
import { registerDeleteCommand } from '../../src/commands/delete.js';
import { initI18n } from '../../src/utils/i18n.js';

describe('i18n integration', () => {
  let program: Command;

  beforeAll(async () => {
    await initI18n();
    program = new Command();
    program.exitOverride(); // Prevent process.exit in tests
  });

  describe('command descriptions are in English', () => {
    it('should have English descriptions for all commands', () => {
      // Register all commands
      registerSaveCommand(program);
      registerLoadCommand(program);
      registerListCommand(program);
      registerDeleteCommand(program);

      // Check save command
      const saveCmd = program.commands.find(cmd => cmd.name() === 'save');
      expect(saveCmd?.description()).toBe('Save the current CLAUDE.md and command settings');

      // Check load command
      const loadCmd = program.commands.find(cmd => cmd.name() === 'load');
      expect(loadCmd?.description()).toBe('Restore a saved configuration to the current directory');

      // Check list command
      const listCmd = program.commands.find(cmd => cmd.name() === 'list');
      expect(listCmd?.description()).toBe('List saved sets');

      // Check delete command
      const deleteCmd = program.commands.find(cmd => cmd.name() === 'delete');
      expect(deleteCmd?.description()).toBe('Delete a saved set');
    });

    it('should have English option descriptions', () => {
      const testProgram = new Command();
      registerSaveCommand(testProgram);
      
      const saveCmd = testProgram.commands.find(cmd => cmd.name() === 'save');
      const forceOption = saveCmd?.options.find(opt => opt.short === '-f');
      expect(forceOption?.description).toBe('Skip overwrite confirmation');

      const allOption = saveCmd?.options.find(opt => opt.short === '-a');
      expect(allOption?.description).toBe('Save all files');
    });
  });

  describe('help text is in English', () => {
    it('should display English help text for save command', () => {
      const testProgram = new Command();
      testProgram.exitOverride();
      registerSaveCommand(testProgram);
      
      const saveCmd = testProgram.commands.find(cmd => cmd.name() === 'save');
      const helpInfo = saveCmd?.helpInformation();
      
      expect(helpInfo).toContain('Save the current CLAUDE.md and command settings');
      expect(helpInfo).toContain('save');
      expect(helpInfo).toContain('<name>');
    });

    it('should display English help text for load command', () => {
      const testProgram = new Command();
      testProgram.exitOverride();
      registerLoadCommand(testProgram);
      
      const loadCmd = testProgram.commands.find(cmd => cmd.name() === 'load');
      const helpInfo = loadCmd?.helpInformation();
      
      expect(helpInfo).toContain('Restore a saved configuration to the current directory');
      expect(helpInfo).toContain('load');
      expect(helpInfo).toContain('<name>');
    });
  });
});