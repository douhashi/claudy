# claudy

Claude AI Configuration File Management Tool

[![npm version](https://badge.fury.io/js/claudy.svg)](https://badge.fury.io/js/claudy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📋 Overview

claudy is a CLI tool for managing Claude AI configuration files (CLAUDE.md, .claude/commands/**/*.md). It allows you to easily switch between different configuration sets for multiple projects and contexts.

### Key Features

- 🗂️ **Configuration Set Management** - Save and restore different configurations for each project
- 🔄 **Easy Switching** - Switch configurations with a single command
- 🛡️ **Safe Operations** - Backup existing files, confirmation before deletion
- 🌐 **Cross-platform Support** - Works on macOS and Linux
- 📝 **Type-safe** - Robust code implemented in TypeScript

## 🚀 Installation

### Requirements

- **OS**: macOS, Linux
- **Node.js**: 18.x, 20.x, 22.x

### npm (Recommended)

```bash
npm install -g claudy
```

### yarn

```bash
yarn global add claudy
```

### pnpm

```bash
pnpm add -g claudy
```

## 📖 Usage

### Basic Workflow

1. **Save Current Configuration**
   ```bash
   # In your project root directory
   claudy save myproject
   ```

2. **List Saved Configurations**
   ```bash
   claudy list
   ```

3. **Load a Different Configuration**
   ```bash
   # Navigate to another project
   cd ~/another-project
   claudy load myproject
   ```

### Commands

For detailed command reference, see [CLI Command Reference](docs/cli-reference.md).

#### `claudy save <name>`
Save Claude configuration files as a named set. Interactive file selection is available by default.

```bash
claudy save myproject       # Interactively select files to save (default)
claudy save frontend -a     # Automatically save all files
claudy save backend -f      # Force overwrite existing set
claudy save project-v2 -a -f # Auto-save all files and overwrite existing set
```

**Options:**
- `-a, --all` - Automatically save all files (skip interactive selection)
- `-f, --force` - Overwrite existing set without confirmation

**Target Files:**
- Project level:
  - `CLAUDE.md` - Main configuration file
  - `.claude/commands/**/*.md` - Custom command definitions
- User level (selectable by default):
  - `~/.claude/CLAUDE.md` - Global settings
  - `~/.claude/commands/**/*.md` - Global commands

#### `claudy load <name>`
Restore a saved configuration set to the current directory.

```bash
claudy load frontend        # Load "frontend" set
claudy load backend -f      # Force overwrite existing files
```

**Existing File Handling Options:**
- Create backup (.bak files)
- Overwrite
- Cancel

#### `claudy list`
Display list of saved configuration sets.

```bash
claudy list                 # Show all sets
claudy list -v              # Show with detailed information
```

**Display Contents:**
- Set name
- Creation date
- Number of files

#### `claudy delete <name>`
Delete specified configuration set.

```bash
claudy delete old-project   # Delete with confirmation
claudy delete temp -f       # Delete immediately
```

### Global Options

- `-v, --verbose` - Show verbose logs
- `-h, --help` - Display help
- `-V, --version` - Display version

## 💡 Examples

### Managing Project Templates

```bash
# Create ideal configuration in template project
cd ~/templates/react-app
vim CLAUDE.md
# ... Write detailed instructions for Claude AI ...

# Save as template (interactively select only necessary files)
claudy save react-template

# Use in new project
cd ~/projects/new-react-app
claudy load react-template
```

### Sharing Configurations Within Team

```bash
# Save team standard configuration (including all files)
claudy save team-standard -a

# Other members can use the same configuration
claudy load team-standard
```

### Context Switching

```bash
# Configuration for frontend development
claudy save frontend-context

# Configuration for backend development
claudy save backend-context

# Switch as needed
claudy load frontend-context  # When working on frontend
claudy load backend-context   # When working on backend
```

## 🛡️ Error Handling

claudy provides appropriate messages and solutions for various error cases:

- **File Access Permission Errors** - Suggests running with administrator privileges
- **Insufficient Disk Space** - Suggests deleting unnecessary files
- **File Lock Errors** - Includes retry functionality
- **Invalid Set Names** - Guides on allowed characters

## 🔧 Configuration

### Storage Location

Configuration sets are saved in the following locations:

- **Windows**: `%USERPROFILE%\.claudy\`
- **macOS/Linux**: `~/.claudy/`

### Directory Structure

```
~/.claudy/
├── myproject/
│   ├── CLAUDE.md
│   └── .claude/
│       └── commands/
│           ├── build.md
│           └── test.md
├── frontend/
│   ├── CLAUDE.md
│   └── .claude/
│       └── commands/
│           └── dev.md
└── backend/
    ├── CLAUDE.md
    └── .claude/
        └── commands/
            └── deploy.md
```

## 🚧 Troubleshooting

### "Set not found" Error

```bash
# Check saved sets
claudy list

# Check for typos in set name
claudy load myproject  # Not "myProject"
```

### Permission Errors

```bash
# For Windows (run as administrator)
# For macOS/Linux
sudo claudy save myproject
```

### File Lock Errors

If files are open in editor or IDE, close them before retrying.

## 🤝 Contributing

### Development Environment Setup

```bash
# Clone repository
git clone https://github.com/douhashi/claudy.git
cd claudy

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Build and Test

```bash
# TypeScript compilation
npm run build

# Run tests
npm test

# Lint check
npm run lint

# Type check
npm run type-check
```

### Pull Request Guidelines

1. For new features, create an Issue first for discussion
2. Add tests (maintain coverage above 80%)
3. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
4. Maintain TypeScript type safety

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

This project is made possible by the feedback and support from the developer community using Claude AI.

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/douhashi/claudy/issues)
- **Discussions**: [GitHub Discussions](https://github.com/douhashi/claudy/discussions)

---

Made with ❤️ by [douhashi](https://github.com/douhashi) and contributors