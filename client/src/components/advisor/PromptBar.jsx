import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Alert, Icon, TextInput } from '../ui';
import { useAdvisorPrompt } from '../../hooks/useAdvisorPrompt';
import { formatShekels } from '../../utils/money';

// explanationKey is a static locale key per verdict category (never a
// sentence — server has no locale context, client/CLAUDE.md § i18n) with
// all dynamic data riding along in the response's own structured fields,
// same pattern as forecast.recommendation (ForecastBanner.jsx).
//
// `reasoning` is the one exception: a free-text explanation the model wrote
// for a conversational follow-up ("how did you calculate that?"), in the
// user's own language — docs/features/AGENTS.md § Agent 1. It replaces the
// locale-key line entirely rather than appending to it, so a follow-up
// reads as an answer, not a repeat of the verdict banner. This is dynamic
// AI-generated content, not a hardcoded UI string, so client/CLAUDE.md's
// "zero hardcoded strings" i18n rule doesn't apply here — same category as
// other AI-generated free text already unrendered through i18n (e.g.
// AI-parsed transaction descriptions).
function replyText(t, message) {
  if (message.reasoning) return message.reasoning;
  return t(message.explanationKey, {
    amount: message.amountAgorot != null ? formatShekels(message.amountAgorot) : undefined,
    balance: message.projectedBalanceAfterAgorot != null ? formatShekels(message.projectedBalanceAfterAgorot) : undefined,
    cutAmount: message.suggestion ? formatShekels(message.suggestion.cutAgorot) : undefined,
    envelope: message.suggestion?.envelopeName,
  });
}

// Floating AI prompt bar, shown on every authenticated page (AppShellLayout).
// Translated (not copied) from docs/design-ref/DashboardPage.tsx.md's mock —
// see docs/features/AGENTS.md § Agent 1 for the real agent this is the
// transport layer for. useAdvisorPrompt owns all conversation state; this
// component is presentational.
//
// `collapsed` is separate from `messages`: collapsing hides the panel
// without discarding history (unlike the header's clear button, which calls
// `reset`), so a conversation survives being tucked away. It's in-memory
// only — deliberately not persisted to localStorage, since it's a
// per-page-session convenience, not durable state.
const CHIP_KEYS = ['affordDiningOut', 'groceriesLeft', 'unbudgetedExpense'];

export function PromptBar() {
  const { t } = useTranslation();
  const { messages, isPending, error, submit, reset } = useAdvisorPrompt();
  const [input, setInput] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const hasMessages = messages.length > 0;
  const open = hasMessages && !collapsed;

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, isPending]);

  const handleSubmit = () => {
    if (!input.trim() || isPending) return;
    submit(input);
    setInput('');
  };

  const handleChipClick = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleClose = () => {
    reset();
    setInput('');
  };

  if (collapsed) {
    return (
      <div className="fixed bottom-5 end-5 z-50">
        <ActionIcon
          size="xl"
          radius="pill"
          onClick={() => setCollapsed(false)}
          aria-label={t('advisor.expand')}
          className="relative h-12 w-12 bg-brand-gradient shadow-lg"
        >
          <Icon name="sparkles" size="sm" className="text-text-on-fill" />
          {hasMessages && (
            <span className="absolute end-0 top-0 h-2.5 w-2.5 rounded-pill bg-accent ring-2 ring-bg-page" />
          )}
        </ActionIcon>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 inset-x-0 z-50 mx-auto w-full max-w-xl px-4">
      <div className="overflow-hidden rounded-lg border border-border-card bg-bg-surface-translucent shadow-lg backdrop-blur-md">
        {hasMessages && (
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
            <p className="flex items-center gap-1 text-2xs font-semibold text-accent">
              <Icon name="sparkles" size="xs" />
              {t('advisor.title')}
            </p>
            <div className="flex items-center gap-1">
              <ActionIcon variant="subtle" size="sm" onClick={() => setCollapsed(true)} aria-label={t('advisor.collapse')}>
                <Icon name="chevronDown" size="xs" />
              </ActionIcon>
              <ActionIcon variant="subtle" size="sm" onClick={handleClose} aria-label={t('advisor.close')}>
                <Icon name="x" size="xs" />
              </ActionIcon>
            </div>
          </div>
        )}

        {open && (
          <div ref={scrollRef} className="flex max-h-64 scroll-smooth flex-col gap-2 overflow-y-auto px-4 py-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-snug text-start ${
                    m.role === 'user'
                      ? 'rounded-ee-sm bg-brand-gradient-strong text-text-on-fill'
                      : 'rounded-ss-sm bg-bg-subtle text-text-secondary'
                  }`}
                >
                  {m.role === 'user' ? m.text : replyText(t, m)}
                </div>
              </div>
            ))}
            {isPending && (
              <div className="flex justify-start" aria-live="polite">
                <div className="flex items-center gap-1 rounded-lg rounded-ss-sm bg-bg-subtle px-3 py-2.5">
                  <span className="sr-only">{t('advisor.thinking')}</span>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-text-muted [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-text-muted [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-pill bg-text-muted [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="px-4 pt-3">
            <Alert size="xs">{t('advisor.error')}</Alert>
          </div>
        )}

        {!hasMessages && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-1 pt-3">
            {CHIP_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleChipClick(t(`advisor.chips.${key}`))}
                className="rounded-pill border border-border-subtle bg-transparent px-3 py-1 text-2xs text-text-secondary transition-colors duration-fast hover:border-accent hover:bg-accent-subtle hover:text-accent"
              >
                {t(`advisor.chips.${key}`)}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-gradient">
            <Icon name="sparkles" size="xs" className="text-text-on-fill" />
          </span>
          <TextInput
            ref={inputRef}
            variant="unstyled"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={t('advisor.placeholder')}
            aria-label={t('advisor.placeholder')}
            className="flex-1"
          />
          {!hasMessages && (
            <ActionIcon variant="subtle" size="sm" onClick={() => setCollapsed(true)} aria-label={t('advisor.collapse')}>
              <Icon name="chevronDown" size="xs" />
            </ActionIcon>
          )}
          <ActionIcon
            size="md"
            radius="md"
            onClick={handleSubmit}
            disabled={!input.trim() || isPending}
            loading={isPending}
            aria-label={t('advisor.send')}
            className="bg-brand-gradient text-text-on-fill disabled:opacity-30"
          >
            <Icon name="send" size="xs" />
          </ActionIcon>
        </div>
      </div>
    </div>
  );
}
