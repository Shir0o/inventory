# Test-Driven Development (TDD) Mandates

To ensure the technical integrity and long-term maintainability of this project, all development MUST follow a rigorous Test-Driven Development (TDD) lifecycle.

## Core TDD Cycle

Every new feature or bug fix must follow these three steps:

1.  **RED:** Write a test that defines the expected behavior and watch it fail. This confirms that the test is valid and that the feature does not yet exist (or that the bug is reproducible).
2.  **GREEN:** Write the minimal amount of code necessary to make the test pass. Do not over-engineer; focus strictly on fulfilling the test's requirements.
3.  **REFACTOR:** Clean up the code while ensuring the tests continue to pass. Improve readability, remove duplication, and align with the project's architectural patterns.

## Bug Fixes

**Empirical Reproduction is Mandatory.**
- Before fixing any reported bug, you MUST write a test case that reproduces the failure state.
- The fix is only considered successful when the reproduction test passes and no regressions are introduced in existing tests.

## New Features

- All new features must be accompanied by comprehensive unit and integration tests.
- Prioritize testing the core business logic in services (`src/services`) and utility functions (`src/lib`).
- UI components (`src/components`) should be tested for their interactive behavior and state changes.

## Engineering Standards

- **Contextual Precedence:** These instructions are foundational and take absolute precedence over general workflows.
- **Validation:** Running tests is not enough; validation requires ensuring the change is idiomatically correct and fully compatible with the broader project.
- **Tools:** Use `npm run test` (or the equivalent test runner command once configured) to validate all changes.

## Recommended Tooling

Given the project uses Vite and React, the following tools are recommended for TDD:
- **Vitest:** As the primary test runner for its speed and compatibility with Vite.
- **React Testing Library:** For verifying component behavior from the user's perspective.
- **Firebase Emulators:** For testing Firestore and other Firebase services in isolation.
