import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Alert, Icon, TextInput } from '../ui';
import { useAdvisorPrompt } from '../../hooks/useAdvisorPrompt';

// Floating AI prompt bar, shown on every authenticated page (AppShellLayout).
// Translated (not copied) from docs/design-ref/DashboardPage.tsx.md's mock —
// see docs/features/AGENTS.md § Agent 1 for the real agent this is the
// transport layer for. useAdvisorPrompt owns all conversation state; this
// component is presentational.
const CHIP_KEYS = ['affordDiningOut', 'groceriesLeft', 'unbudgetedExpense'];

export function PromptBar() {
  const { t } = useTranslation();
  const { messages, isPending, error, submit, reset } = useAdvisorPrompt();
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const open = messages.length > 0;

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

  return (
    <div className="fixed bottom-5 inset-x-0 z-50 mx-auto w-full max-w-xl px-4">
      <div className="overflow-hidden rounded-lg border border-border-card bg-bg-surface-translucent shadow-lg backdrop-blur-md">
        {open && (
          <div className="flex max-h-44 flex-col gap-2 overflow-y-auto border-b border-border-subtle px-4 pb-2 pt-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-snug text-start ${
                    m.role === 'user' ? 'bg-brand-gradient-strong text-bg-surface' : 'bg-bg-subtle text-text-secondary'
                  }`}
                >
                  {m.role === 'assistant' && (
                    <p className="mb-1 flex items-center gap-1 text-2xs font-semibold text-accent">
                      <Icon name="sparkles" size="xs" />
                      {t('advisor.title')}
                    </p>
                  )}
                  {m.role === 'user' ? m.text : t(m.replyKey)}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="px-4 pt-3">
            <Alert size="xs">{t('advisor.error')}</Alert>
          </div>
        )}

        {!open && (
          <div className="flex items-center gap-2 overflow-x-auto px-4 pb-1 pt-3">
            {CHIP_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleChipClick(t(`advisor.chips.${key}`))}
                className="whitespace-nowrap rounded-pill bg-bg-subtle px-2.5 py-1 text-2xs text-text-secondary transition-colors duration-fast hover:bg-accent-subtle hover:text-accent"
              >
                {t(`advisor.chips.${key}`)}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-gradient">
            <Icon name="sparkles" size="xs" className="text-bg-surface" />
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
          {open && (
            <ActionIcon variant="subtle" size="sm" onClick={handleClose} aria-label={t('advisor.close')}>
              <Icon name="x" size="xs" />
            </ActionIcon>
          )}
          <ActionIcon
            size="md"
            radius="md"
            onClick={handleSubmit}
            disabled={!input.trim()}
            loading={isPending}
            aria-label={t('advisor.send')}
            className="bg-brand-gradient text-bg-surface disabled:opacity-30"
          >
            <Icon name="send" size="xs" />
          </ActionIcon>
        </div>
      </div>
    </div>
  );
}
