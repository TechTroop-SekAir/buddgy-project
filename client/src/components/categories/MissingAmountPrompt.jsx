import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, NumberInput } from '../ui';
import { shekelsToAgorot } from '../../utils/money';
import { formatDate } from '../../utils/date';
import { getErrorMessage } from '../../utils/errorMessages';

// One row per planned expense with a missing/zero amount — each row owns its
// own input/submit state so submitting one doesn't disturb the others still
// pending in the list.
function MissingAmountRow({ plannedExpense, onSubmit }) {
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
      await onSubmit(plannedExpense.id, { amount_agorot: shekelsToAgorot(Number(amountShekels)) });
    } catch (err) {
      setError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[10rem]">
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

export function MissingAmountPrompt({ plannedExpenses, onSubmit }) {
  const { t } = useTranslation();

  if (!plannedExpenses || plannedExpenses.length === 0) return null;

  return (
    <Card padding={0} className="bg-bg-surface border border-border-card rounded-lg">
      <div className="px-6 py-5 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{t('forecast.missingAmountTitle')}</h2>
          <p className="text-sm text-text-secondary">{t('forecast.missingAmountBody')}</p>
        </div>
        <div className="flex flex-col gap-4">
          {plannedExpenses.map((plannedExpense) => (
            <MissingAmountRow key={plannedExpense.id} plannedExpense={plannedExpense} onSubmit={onSubmit} />
          ))}
        </div>
      </div>
    </Card>
  );
}
