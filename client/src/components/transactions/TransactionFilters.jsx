import { useTranslation } from 'react-i18next';
import { DateInput, Select, TextInput } from '../ui';
import { getMonthBounds } from '../../utils/date';
import { useMonth } from '../../context/MonthContext';
import { MonthNavigator } from '../shared/MonthNavigator';

export const UNASSIGNED_VALUE = 'unassigned';

export function TransactionFilters({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  categoryOptions,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}) {
  const { t } = useTranslation();
  const { month } = useMonth();
  const { start, end } = getMonthBounds(month);
  const filterOptions = [
    { value: '', label: t('transactions.allCategories') },
    { value: UNASSIGNED_VALUE, label: t('transactions.uncategorized') },
    ...categoryOptions,
  ];

  return (
    <div className="flex flex-col gap-4">
      <MonthNavigator />

      <div className="flex flex-wrap items-end gap-4">
        <TextInput
          className="flex-1 min-w-[10rem]"
          label={t('transactions.searchLabel')}
          placeholder={t('transactions.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
        <Select
          className="flex-1 min-w-[10rem]"
          label={t('transactions.categoryLabel')}
          data={filterOptions}
          value={categoryId}
          onChange={(value) => onCategoryChange(value ?? '')}
          clearable
        />
      </div>

      {/* From/To always stay paired on one row — never stagger onto
          separate lines even on narrow screens. */}
      <div className="grid grid-cols-2 gap-2 max-w-sm">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">{t('transactions.fromLabel')}</span>
          <DateInput
            className="w-full rounded-md border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
            min={start}
            max={dateTo || end}
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-primary">{t('transactions.toLabel')}</span>
          <DateInput
            className="w-full rounded-md border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
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
