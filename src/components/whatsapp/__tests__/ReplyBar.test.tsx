// src/components/whatsapp/__tests__/ReplyBar.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// emoji-mart pulls in a large data bundle and touches APIs jsdom lacks; the
// picker's internals are not what this file is testing.
vi.mock('@emoji-mart/react', () => ({ default: () => <div data-testid="emoji-picker" /> }));
vi.mock('@emoji-mart/data', () => ({ default: {} }));

import { ReplyBar } from '@/components/whatsapp/ReplyBar';

beforeEach(() => vi.clearAllMocks());

const setup = (props: Partial<React.ComponentProps<typeof ReplyBar>> = {}) => {
  const onSendText = vi.fn();
  const view = render(<ReplyBar windowOpen onSendText={onSendText} {...props} />);
  return { onSendText, ...view };
};

describe('ReplyBar — sending', () => {
  it('sends on Enter', async () => {
    const { onSendText } = setup();
    const box = screen.getByLabelText('Message');

    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    await waitFor(() => expect(onSendText).toHaveBeenCalledWith('hello'));
  });

  it('inserts a newline on Shift+Enter instead of sending', () => {
    const { onSendText } = setup();
    const box = screen.getByLabelText('Message');

    fireEvent.change(box, { target: { value: 'line one' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });

    expect(onSendText).not.toHaveBeenCalled();
  });

  it('does not send while an IME composition is active', () => {
    const { onSendText } = setup();
    const box = screen.getByLabelText('Message');

    fireEvent.change(box, { target: { value: 'にほんご' } });
    // Committing a Japanese/Chinese candidate fires Enter mid-composition.
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });

    expect(onSendText).not.toHaveBeenCalled();
  });

  it('refuses to send whitespace only', () => {
    const { onSendText } = setup();
    const box = screen.getByLabelText('Message');

    fireEvent.change(box, { target: { value: '   ' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(onSendText).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  it('trims the message and clears the box after sending', async () => {
    const { onSendText } = setup();
    const box = screen.getByLabelText('Message') as HTMLTextAreaElement;

    fireEvent.change(box, { target: { value: '  padded  ' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(onSendText).toHaveBeenCalledWith('padded'));
    await waitFor(() => expect(box.value).toBe(''));
  });
});

describe('ReplyBar — the closed 24-hour window', () => {
  it('disables free-form text and SAYS WHY', () => {
    setup({ windowOpen: false });

    expect(screen.getByLabelText('Message')).toBeDisabled();
    const reason = screen.getByTestId('reply-bar-reason');
    expect(reason).toHaveTextContent(/24-hour reply window has closed/i);
    // The user is told what they CAN do, not just what they cannot.
    expect(reason).toHaveTextContent(/approved template/i);
  });

  it('keeps the template picker available when the window is shut', () => {
    setup({ windowOpen: false, onSendTemplate: vi.fn() });
    expect(screen.getByRole('button', { name: /send a template/i })).toBeEnabled();
  });

  it('shows a caller-supplied reason in preference to the default', () => {
    setup({ windowOpen: false, disabledReason: 'This contact has opted out.' });
    expect(screen.getByTestId('reply-bar-reason')).toHaveTextContent('This contact has opted out.');
  });

  it('shows no reason banner while the window is open', () => {
    setup();
    expect(screen.queryByTestId('reply-bar-reason')).toBeNull();
  });

  it('explains a hard disable too, rather than going silently grey', () => {
    setup({ disabled: true });
    expect(screen.getByLabelText('Message')).toBeDisabled();
    expect(screen.getByTestId('reply-bar-reason')).toBeInTheDocument();
  });
});

describe('ReplyBar — attachments', () => {
  it('offers the attachment control only when a handler is supplied', () => {
    const { unmount } = setup();
    expect(screen.queryByRole('button', { name: /attach a file/i })).toBeNull();
    unmount();

    setup({ onAttach: vi.fn() });
    expect(screen.getByRole('button', { name: /attach a file/i })).toBeInTheDocument();
  });

  it('passes a chosen file to onAttach with its kind', async () => {
    const onAttach = vi.fn();
    const { container } = setup({ onAttach });

    const input = container.querySelector('input[accept="image/*"]') as HTMLInputElement;
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onAttach).toHaveBeenCalledWith(file, 'image'));
  });
});
