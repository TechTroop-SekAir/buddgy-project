import { useTranslation } from 'react-i18next';
import { Button, DateInput, Select, TextInput } from '../ui';
import { getMonthBounds, getMonthLabel } from '../../utils/date';
import { useLocale } from '../../context/LocaleContext';

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
  const { direction } = useLocale();
  // Chevrons are directional glyphs, not text — "previous" must point toward
  // the start of reading order, which flips with RTL, so pick the glyph
  // rather than translate it.
  const prevGlyph = direction === 'rtl' ? '→' : '←';
  const nextGlyph = direction === 'rtl' ? '←' : '→';
  const { start, end } = getMonthBounds(month);
  const categoryOptions = [
    { value: '', label: t('transactions.allCategories') },
    { value: UNASSIGNED_VALUE, label: t('transactions.uncategorized') },
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
          onClick={() => onMonthChange(-1)}
          aria-label={t('transactions.prevMonth')}
        >
          {prevGlyph}
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
          onClick={() => onMonthChange(1)}
          aria-label={t('transactions.nextMonth')}
        >
          {nextGlyph}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <TextInput
          label={t('transactions.searchLabel')}
          placeholder={t('transactions.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
        <Select
          label={t('transactions.categoryLabel')}
          data={categoryOptions}
          value={envelopeId}
          onChange={(value) => onEnvelopeChange(value ?? '')}
          clearable
        />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">{t('transactions.fromLabel')}</span>
          <DateInput
            className="rounded-md border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
            min={start}
            max={dateTo || end}
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">{t('transactions.toLabel')}</span>
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
