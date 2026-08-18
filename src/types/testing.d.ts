/**
 * Registers `@testing-library/jest-dom`'s matchers (`toBeInTheDocument`,
 * `toHaveAttribute`, …) on vitest's `expect`, for the TypeScript compiler.
 *
 * `vitest.setup.ts` performs the runtime half of this; `tsconfig.app.json` only
 * includes `src`, so the type half has to live in here.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
