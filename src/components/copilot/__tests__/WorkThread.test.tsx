// Smoke test for the /work full-page thread.
//
// The port from the Next starter swaps base-ui for Radix (`render=` → `asChild`)
// and Tailwind v4 for v3, neither of which the type-checker can verify. This
// test mounts the whole primitive tree against a stub adapter so a broken
// asChild/Slot chain or a missing 0.14.x export fails in CI, not in the browser.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from '@assistant-ui/react';

import { WorkThread } from '../WorkThread';

// jsdom ships neither of these; the viewport/composer primitives measure their
// own size on mount. Scoped to this file so the shared setup stays untouched.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollTo ??= function scrollTo() {};

const stubAdapter: ChatModelAdapter = {
  async *run() {
    yield { content: [{ type: 'text', text: 'ok' }] };
  },
};

function Harness() {
  const runtime = useLocalRuntime(stubAdapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <WorkThread />
    </AssistantRuntimeProvider>
  );
}

describe('WorkThread', () => {
  it('mounts the empty state with a usable composer', () => {
    render(<Harness />);

    // getBy* throws when absent, so these double as existence assertions.
    expect(screen.getByText('How can I help you today?')).toBeTruthy();
    expect(screen.getByLabelText('Message input').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Send message').tagName).toBe('BUTTON');
  });
});
