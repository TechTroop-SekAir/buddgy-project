import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Card, NumberInput } from '../ui';
import { SpendPromptModal } from './SpendPromptModal';
import { formatDate } from '../../utils/date';
import { hasMissingAmount, isUpcomingEvent, isDismissedUpcomingEvent } from '../../utils/plannedExpenseStatus';
import { getErrorMessage } from '../../utils/errorMessages';
import { shekelsToAgorot } from '../../utils/money';

// One row per upcoming event — owns its own dismiss-pending/error state,
// same reasoning as PlannedExpenseRow.jsx/MissingAmountRow.jsx: a shared
// page-level mutation can't tell which row's click is in flight.
function UpcomingEventRow({ plannedExpense, onDismiss, onOpenSpendModal }) {
  const { t } = useTranslation();
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissError, setDismissError] = useState('');

  const handleDismiss = async () => {
    setDismissError('');
    setIsDismissing(true);
    try {
      await onDismiss(plannedExpense.id);
    } catch (err) {
      setDismissError(getErrorMessage(err.message, t));
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle py-3 last:border-0">
      <div className="min-w-40 flex-1">
        <p className="text-sm font-medium text-text-primary">{plannedExpense.title}</p>
        <p className="text-xs text-text-secondary">{formatDate(plannedExpense.due_date)}</p>
      </div>
      {hasMissingAmount(plannedExpense) && <Badge color="status-warning">{t('plannedExpenses.missingAmount.badge')}</Badge>}
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <Button variant="outline" color="gray" size="sm" loading={isDismissing} onClick={handleDismiss}>
            {t('plannedExpenses.upcoming.dismiss')}
          </Button>
          <Button variant="filled" color="accent" size="sm" onClick={() => onOpenSpendModal(plannedExpense)}>
            {t('plannedExpenses.upcoming.spend')}
          </Button>
        </div>
        {dismissError && <Alert size="xs">{dismissError}</Alert>}
      </div>
    </div>
  );
}

function DismissedEventRow({ plannedExpense, onUndoDismiss }) {
  const { t } = useTranslation();
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoError, setUndoError] = useState('');

  const handleUndo = async () => {
    setUndoError('');
    setIsUndoing(true);
    try {
      await onUndoDismiss(plannedExpense.id);
    } catch (err) {
      setUndoError(getErrorMessage(err.message, t));
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle py-3 last:border-0">
      <div className="min-w-40 flex-1">
        <p className="text-sm text-text-secondary">{plannedExpense.title}</p>
        <p className="text-xs text-text-secondary">{formatDate(plannedExpense.due_date)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Button variant="subtle" color="accent" size="sm" loading={isUndoing} onClick={handleUndo}>
          {t('plannedExpenses.upcoming.undoDismiss')}
        </Button>
        {undoError && <Alert size="xs">{undoError}</Alert>}
      </div>
    </div>
  );
}

// A confirmed planned expense that's still missing its amount — the one gap
// the Spend flow below doesn't cover, since Spend sets amount and confirms
// in one step. Ported from the old, now-deleted MissingAmountPrompt.jsx.
function NeedsAmountRow({ plannedExpense, onSaveAmount }) {
  const { t } = useTranslation();
  const [amountShekels, setAmountShekels] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!(Number(amountShekels) > 0)) {
      setError(t('forecast.missingAmountInvalid'));
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onSaveAmount(plannedExpense.id, { amount_agorot: shekelsToAgorot(Number(amountShekels)) });
    } catch (err) {
      setError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-b border-border-subtle py-3 last:border-0">
      <div className="min-w-40 flex-1">
        <p className="text-sm font-medium text-text-primary">{plannedExpense.title}</p>
        <p className="text-xs text-text-secondary">{formatDate(plannedExpense.due_date)}</p>
      </div>
      <NumberInput
        aria-label={plannedExpense.title}
        value={amountShekels}
        onChange={(value) => setAmountShekels(String(value ?? ''))}
        placeholder="0"
        leftSection="₪"
        min={0}
        error={error}
        className="w-32"
      />
      <Button type="submit" variant="outline" color="accent" size="sm" loading={isSubmitting}>
        {t('forecast.missingAmountSubmit')}
      </Button>
    </form>
  );
}

// Surfaces calendar events Claude judged likely to cost money (weddings,
// birthdays, flights — anything without an amount in the title that used to
// be silently dropped) so the user can either dismiss them ("this won't cost
// money") or say how much they plan to spend, plus any already-confirmed row
// still missing an amount (formerly MissingAmountPrompt.jsx, folded in here
// per docs/features/HOMEPAGE-FIXES.md so the homepage has one card instead
// of two overlapping ones). See docs/features/UPCOMING-EVENTS.md.
//
// `plannedExpenses` must be fetched with includeDismissed so the "show
// dismissed" toggle has something to undo — see PlannedExpensesPage.jsx.
// `missingAmountPlannedExpenses` is forecastService's list (any non-dismissed
// 'likely' row missing an amount, regardless of confirmation) — filtered
// here to confirmed rows only, since unconfirmed ones already get amount +
// confirmation together via the Spend button.
export function UpcomingEventsCard({
  plannedExpenses,
  missingAmountPlannedExpenses = [],
  categoryOptions,
  onDismiss,
  onUndoDismiss,
  onSpend,
  onSaveAmount,
  className = '',
}) {
  const { t } = useTranslation();
  const [showDismissed, setShowDismissed] = useState(false);
  const [spendModalTarget, setSpendModalTarget] = useState(null);

  const upcoming = plannedExpenses.filter(isUpcomingEvent);
  const dismissed = plannedExpenses.filter(isDismissedUpcomingEvent);
  const needsAmount = missingAmountPlannedExpenses.filter((pe) => pe.is_confirmed);

  if (upcoming.length === 0 && dismissed.length === 0 && needsAmount.length === 0) return null;

  return (
    <Card padding={0} className={`bg-bg-surface border border-border-card rounded-lg shadow-sm ${className}`}>
      <div className="px-6 py-5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-strong">{t('plannedExpenses.upcoming.title')}</h2>
            <p className="text-sm text-text-secondary">{t('plannedExpenses.upcoming.body')}</p>
          </div>
          {dismissed.length > 0 && (
            <Button variant="subtle" color="gray" size="sm" onClick={() => setShowDismissed((v) => !v)}>
              {showDismissed
                ? t('plannedExpenses.upcoming.hideDismissed')
                : t('plannedExpenses.upcoming.showDismissed', { count: dismissed.length })}
            </Button>
          )}
        </div>

        {needsAmount.length > 0 && (
          <div className="flex flex-col mb-2 pb-2 border-b border-border-subtle">
            <p className="text-xs font-medium text-text-secondary mb-1">{t('forecast.missingAmountTitle')}</p>
            {needsAmount.map((plannedExpense) => (
              <NeedsAmountRow key={plannedExpense.id} plannedExpense={plannedExpense} onSaveAmount={onSaveAmount} />
            ))}
          </div>
        )}

        {upcoming.length > 0 ? (
          <div className="flex flex-col">
            {upcoming.map((plannedExpense) => (
              <UpcomingEventRow
                key={plannedExpense.id}
                plannedExpense={plannedExpense}
                onDismiss={onDismiss}
                onOpenSpendModal={setSpendModalTarget}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary py-2">{t('plannedExpenses.upcoming.empty')}</p>
        )}

        {showDismissed && dismissed.length > 0 && (
          <div className="flex flex-col mt-2 pt-2 border-t border-border-subtle">
            <p className="text-xs font-medium text-text-secondary mb-1">{t('plannedExpenses.upcoming.dismissedTitle')}</p>
            {dismissed.map((plannedExpense) => (
              <DismissedEventRow key={plannedExpense.id} plannedExpense={plannedExpense} onUndoDismiss={onUndoDismiss} />
            ))}
          </div>
        )}
      </div>

      <SpendPromptModal
        opened={spendModalTarget != null}
        plannedExpense={spendModalTarget}
        categoryOptions={categoryOptions}
        onClose={() => setSpendModalTarget(null)}
        onSubmit={onSpend}
      />
    </Card>
  );
}
