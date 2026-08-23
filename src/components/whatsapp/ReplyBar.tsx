// src/components/whatsapp/ReplyBar.tsx
//
// The composer.
//
//   * multiline textarea that grows with the content and stops at a sane cap
//   * Enter sends, Shift+Enter inserts a newline (the WhatsApp muscle memory)
//   * emoji picker (emoji-mart, already a dependency)
//   * attachment menu (image / document)
//   * template picker for when the 24-hour window has closed
//   * a DISABLED state that says WHY, never one that just goes grey
//
// The 24-hour rule: outside the window Meta rejects free-form messages outright,
// so the text input is disabled and the template picker becomes the primary
// action. Telling the user "you can only send an approved template now" is the
// whole point — a silently inert box is the failure mode this replaces.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Smile, Paperclip, Image as ImageIcon, FileText, LayoutTemplate, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import emojiData from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const MAX_ROWS_PX = 140;

export interface ReplyBarTemplate {
  uid: string;
  name: string;
  language?: string;
  /** Preview text shown in the picker. */
  preview?: string;
}

export interface ReplyBarProps {
  /** Free-form text is allowed only while the 24-hour window is open. */
  windowOpen: boolean;
  /** Human-readable reason the composer is disabled, if it is. */
  disabledReason?: string | null;
  /** Approved templates offered when the window is shut. */
  templates?: ReplyBarTemplate[];
  templatesLoading?: boolean;
  onSendText: (text: string) => void | Promise<unknown>;
  onSendTemplate?: (template: ReplyBarTemplate) => void | Promise<unknown>;
  onAttach?: (file: File, kind: 'image' | 'document') => void | Promise<unknown>;
  /** Hard disable (e.g. the backend is not deployed yet). */
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const ReplyBar: React.FC<ReplyBarProps> = ({
  windowOpen,
  disabledReason,
  templates = [],
  templatesLoading = false,
  onSendText,
  onSendTemplate,
  onAttach,
  disabled = false,
  placeholder,
  className,
}) => {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Free-form text needs an open window; templates are always permitted.
  const textDisabled = disabled || !windowOpen;
  const canSend = !textDisabled && value.trim().length > 0 && !sending;

  const reason = useMemo(() => {
    if (disabledReason) return disabledReason;
    if (disabled) return 'Messaging is unavailable right now.';
    if (!windowOpen) {
      return 'The 24-hour reply window has closed. You can only send an approved template until this contact messages you again.';
    }
    return null;
  }, [disabled, disabledReason, windowOpen]);

  // Autogrow: reset to auto first so the box can SHRINK as well as grow.
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_ROWS_PX ? 'auto' : 'hidden';
  }, []);

  useEffect(resize, [value, resize]);

  const submit = useCallback(async () => {
    const body = value.trim();
    if (!body || textDisabled || sending) return;

    setSending(true);
    // Clear optimistically so the user can keep typing; the transcript already
    // shows their message as a pending row.
    setValue('');
    try {
      await onSendText(body);
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [value, textDisabled, sending, onSendText]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter (and IME composition) insert a newline.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const insertEmoji = (emoji: { native?: string }) => {
    const native = emoji?.native;
    if (!native) return;
    const el = textareaRef.current;
    if (!el) {
      setValue((v) => v + native);
      return;
    }
    // Insert at the caret rather than at the end.
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + native + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + native.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const pickFile = (kind: 'image' | 'document') => {
    (kind === 'image' ? imageInputRef : documentInputRef).current?.click();
  };

  const onFile = (kind: 'image' | 'document') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the SAME file twice still fires a change event.
    e.target.value = '';
    if (file && onAttach) void onAttach(file, kind);
  };

  return (
    <div className={cn('border-t bg-[#f0f2f5] px-3 py-2', className)} data-testid="reply-bar">
      {/* Why the box is inert. Stated plainly, in place — never a modal. */}
      {reason ? (
        <div
          className="mb-2 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900"
          role="status"
          data-testid="reply-bar-reason"
        >
          <span className="flex-1">{reason}</span>
        </div>
      ) : null}

      <div className="flex items-end gap-1.5">
        {/* Emoji */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-[#54656f]"
              disabled={textDisabled}
              aria-label="Insert emoji"
            >
              <Smile className="h-5 w-5" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto border-none p-0" align="start" side="top">
            <Picker
              data={emojiData}
              onEmojiSelect={insertEmoji}
              theme="light"
              previewPosition="none"
              skinTonePosition="none"
            />
          </PopoverContent>
        </Popover>

        {/* Attachments */}
        {onAttach ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-[#54656f]"
                disabled={textDisabled}
                aria-label="Attach a file"
              >
                <Paperclip className="h-5 w-5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="start" side="top">
              <button
                type="button"
                onClick={() => pickFile('image')}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-black/5"
              >
                <ImageIcon className="h-4 w-4 text-pink-600" aria-hidden="true" />
                Photo
              </button>
              <button
                type="button"
                onClick={() => pickFile('document')}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-black/5"
              >
                <FileText className="h-4 w-4 text-blue-600" aria-hidden="true" />
                Document
              </button>
            </PopoverContent>
          </Popover>
        ) : null}

        {/* Template picker — the primary action once the window has shut. */}
        {onSendTemplate ? (
          <Popover open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={windowOpen ? 'ghost' : 'default'}
                size="icon"
                className={cn('h-9 w-9 shrink-0', windowOpen && 'text-[#54656f]')}
                disabled={disabled}
                aria-label="Send a template"
              >
                <LayoutTemplate className="h-5 w-5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start" side="top">
              <div className="border-b px-3 py-2 text-sm font-medium">Approved templates</div>
              <div className="max-h-64 overflow-y-auto">
                {templatesLoading ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading templates…
                  </div>
                ) : templates.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    No approved templates available.
                  </p>
                ) : (
                  templates.map((template) => (
                    <button
                      key={template.uid}
                      type="button"
                      onClick={() => {
                        setTemplatesOpen(false);
                        void onSendTemplate(template);
                      }}
                      className="block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-black/5"
                    >
                      <span className="block text-sm font-medium">{template.name}</span>
                      {template.preview ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {template.preview}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        {/* The composer itself */}
        <div className="flex min-w-0 flex-1 items-end rounded-lg bg-white px-3 py-1.5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={textDisabled}
            aria-label="Message"
            placeholder={
              textDisabled
                ? windowOpen
                  ? 'Messaging unavailable'
                  : 'Send a template to reopen the conversation'
                : (placeholder ?? 'Type a message')
            }
            className="max-h-[140px] min-h-[24px] w-full resize-none border-0 bg-transparent text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <Button
          type="button"
          size="icon"
          onClick={() => void submit()}
          disabled={!canSend}
          className="h-9 w-9 shrink-0 rounded-full bg-[#25d366] text-white hover:bg-[#1eb356] disabled:opacity-40"
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Hidden inputs live outside the popover so they survive it closing. */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile('image')}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.csv"
        className="hidden"
        onChange={onFile('document')}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
};

export default ReplyBar;
