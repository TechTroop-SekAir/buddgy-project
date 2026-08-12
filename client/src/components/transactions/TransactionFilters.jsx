import { useTranslation } from 'react-i18next';
import { Button, DateInput, Select, TextInput } from '../ui';
import { getMonthBounds, getMonthLabel } from '../../utils/date';

export const UNASSIGNED_VALUE = 'unassigned';

export function TransactionFilters({
  month,
  onMonthChange,
  search,
  onSearchChange,
  envelopeId,
  onEnvelopeChange,
  envelopeOptions,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}) {
  const { t } = useTranslation();
  const { start, end } = getMonthBounds(month);
  const categoryOptions = [
    { value: '', label: t('transactions.filters.allCategories') },
    { value: UNASSIGNED_VALUE, label: t('transactions.filters.uncategorized') },
    ...envelopeOptions,
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="subtle"
          color="gray"
          size="xs"
          className="px-2 py-1 text-text-secondary hover:text-text-primary"
          onClick={() => onMonthChange(1)}
          aria-label={t('transactions.filters.nextMonth')}
        >
          →
        </Button>
        <p className="text-lg font-semibold text-text-primary min-w-[10rem] text-center">
          {getMonthLabel(month)}
        </p>
        <Button
          type="button"
          variant="subtle"
          color="gray"
          size="xs"
          className="px-2 py-1 text-text-secondary hover:text-text-primary"
          onClick={() => onMonthChange(-1)}
          aria-label={t('transactions.filters.prevMonth')}
        >
          ←
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <TextInput
          label={t('transactions.filters.search')}
          placeholder={t('transactions.filters.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
        <Select
          label={t('transactions.filters.category')}
          data={categoryOptions}
          value={envelopeId}
          onChange={(value) => onEnvelopeChange(value ?? '')}
          clearable
        />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">{t('transactions.filters.from')}</span>
          <DateInput
            className="rounded-md border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
            min={start}
            max={dateTo || end}
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">{t('transactions.filters.to')}</span>
          <DateInput
            className="rounded-md border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
            min={dateFrom || start}
            max={end}
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
