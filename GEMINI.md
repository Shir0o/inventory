# Project Mandates: Test-Driven Development (TDD)

This project strictly adheres to **Test-Driven Development (TDD)** principles. All future development, including feature implementations and bug fixes, must follow the workflow below.

## 1. TDD Workflow
- **Red**: Write a failing test that defines the desired improvement or reproduced bug.
- **Green**: Implement the minimum amount of code necessary to make the test pass.
- **Refactor**: Clean up the code while ensuring all tests remain passing.

## 2. Testing Standards
- **Framework**: Use **Vitest** with **React Testing Library** and **jsdom**.
- **Location**: Place tests adjacent to the source file or in the `src/context/` directory (e.g., `FileName.test.tsx`).
- **Mocking**: Follow the patterns established in `src/test/setup.ts` and `src/context/FirebaseContext.test.tsx` for mocking Firebase and Firestore services.
- **Validation**: No code change is considered complete until it has been verified by an automated test.

## 3. Command Usage
Always run tests before and after changes to ensure stability:
```bash
npx vitest run
```
