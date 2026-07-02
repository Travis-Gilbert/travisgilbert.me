```markdown
# travisgilbert.me Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill outlines the core development patterns and conventions used in the `travisgilbert.me` TypeScript codebase. It covers file naming, import/export styles, commit conventions, and testing patterns to ensure consistency and maintainability across the project. While no specific frameworks or automated workflows were detected, this guide provides best practices and suggested commands for common tasks.

## Coding Conventions

### File Naming
- **Pattern:** PascalCase
- **Example:**  
  ```plaintext
  UserProfile.ts
  HomePage.tsx
  ```

### Import Style
- **Pattern:** Alias imports (using custom path aliases)
- **Example:**  
  ```typescript
  import { UserService } from '@services/UserService';
  import { Button } from '@components/Button';
  ```

### Export Style
- **Pattern:** Named exports
- **Example:**  
  ```typescript
  // In UserService.ts
  export function getUser(id: string) { ... }
  export const USER_ROLE = 'admin';
  ```

### Commit Messages
- **Type:** Conventional Commits
- **Prefix:** `feat`
- **Average Length:** ~48 characters
- **Example:**  
  ```plaintext
  feat: add user authentication to login page
  ```

## Workflows

### Creating a New Feature
**Trigger:** When starting work on a new feature  
**Command:** `/new-feature`

1. Create a new file using PascalCase, e.g., `NewFeature.ts`.
2. Use alias imports for dependencies.
3. Export all functions/components as named exports.
4. Commit changes using the `feat` prefix:
   ```
   feat: short description of the new feature
   ```

### Writing Tests
**Trigger:** When adding or updating functionality  
**Command:** `/write-test`

1. Create a test file with the pattern `*.test.*`, e.g., `UserService.test.ts`.
2. Write tests for all exported functions/components.
3. Use the project's preferred (unknown) testing framework syntax.
4. Run tests to ensure correctness.

## Testing Patterns

- **File Pattern:** `*.test.*` (e.g., `Component.test.ts`)
- **Framework:** Not specified; follow standard TypeScript testing practices.
- **Example:**  
  ```typescript
  // UserService.test.ts
  import { getUser } from '@services/UserService';

  describe('getUser', () => {
    it('returns user data for valid ID', () => {
      // test implementation
    });
  });
  ```

## Commands
| Command        | Purpose                                      |
|----------------|----------------------------------------------|
| /new-feature   | Scaffold a new feature with correct patterns |
| /write-test    | Create and run tests for a module/component  |
```
