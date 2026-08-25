import { useTranslation } from 'react-i18next';
import { ActionIcon, Button, Icon, NumberInput, TextInput } from '../ui';
import { formatShekelsRounded, shekelsToAgorot } from '../../utils/money';

// Shared row-editor for a month's income sources — extracted from
// onboarding/IncomeStep.jsx so IncomeSettingsCard (Settings' post-onboarding
// editor) and the onboarding wizard render and validate identically instead
// of the two forms drifting apart. Takes the @mantine/form instance so each
// caller owns its own submit button/behavior; this only renders the
// repeatable rows + live total.
export function IncomeRowsFields({ form }) {
  const { t } = useTranslation();

  const totalAgorot = form.values.rows.reduce(
    (sum, row) => sum + (Number(row.amountShekels) > 0 ? shekelsToAgorot(Number(row.amountShekels)) : 0),
    0
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {form.values.rows.map((row, index) => (
          <div key={index} className="flex items-end gap-2 rounded-md border border-border-card bg-bg-hover p-3">
            <TextInput
              className="flex-1"
              label={index === 0 ? t('addCategoryModal.nameLabel') : undefined}
              {...form.getInputProps(`rows.${index}.label`)}
            />
            <NumberInput
              className="w-32"
              label={index === 0 ? t('onboarding.income.amountLabel') : undefined}
              leftSection="₪"
              min={0}
              {...form.getInputProps(`rows.${index}.amountShekels`)}
            />
            <ActionIcon
              type="button"
              variant="subtle"
              color="gray"
              aria-label={t('onboarding.income.removeRow')}
              disabled={form.values.rows.length === 1}
              onClick={() => form.removeListItem('rows', index)}
            >
              <Icon name="trash" size="sm" />
            </ActionIcon>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="subtle"
        color="accent"
        size="sm"
        className="self-start"
        onClick={() => form.insertListItem('rows', { label: '', amountShekels: '' })}
      >
        <Icon name="plus" size="sm" className="me-1" />
        {t('onboarding.income.addRow')}
      </Button>

      <div className="flex items-center gap-3 rounded-lg border border-accent bg-accent-subtle p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-surface">
          <Icon name="trendingUp" size="md" className="text-accent" />
        </span>
        <div>
          <p className="text-xs font-medium text-text-muted">{t('onboarding.income.totalLabel')}</p>
          <p className="num-tabular mt-0.5 font-mono text-2xl font-semibold text-text-primary">
            {formatShekelsRounded(totalAgorot)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Shared validation so IncomeSettingsCard and IncomeStep can't drift apart.
// Callers pass their own `t` (both already call useTranslation) and spread
// the result into their useForm's `validate: { rows: { ... } }`.
export function incomeRowsValidation(t) {
  return {
    label: (value) => (value.trim().length > 0 ? null : t('onboarding.income.errors.labelRequired')),
    amountShekels: (value) => (Number(value) > 0 ? null : t('onboarding.income.errors.amountInvalid')),
  };
}

/** Maps a rows-fields form's values to the API's { label, amount_agorot } shape. */
export function toIncomeRowsPayload(rows) {
  return rows.map((row) => ({
    label: row.label.trim(),
    amount_agorot: shekelsToAgorot(Number(row.amountShekels)),
  }));
}
