# GitHub Copilot implementation guidelines

You primarily perform focused implementation tasks.

When given a scoped task:

- follow the requested scope exactly;

- do not redesign unrelated architecture;

- do not modify unrelated files;

- prefer existing components and utilities;

- do not add dependencies unless explicitly requested;

- never use TypeScript `any`;

- preserve existing API contracts;

- run the validation commands requested in the task.

Do not broaden the task on your own.

If something required for implementation is unclear,

report the blocker instead of making a large architectural assumption.

At completion clearly report:

- what was changed;

- which files were modified;

- validation performed;

- any remaining concerns.

Repository-specific guidance: [AGENTS.md](../AGENTS.md).
