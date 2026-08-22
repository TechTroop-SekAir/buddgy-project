import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Button, Icon, NumberInput, TextInput } from '../ui';
import { formatShekelsRounded, shekelsToAgorot } from '../../utils/money';

export function IncomeStep({ onNext }) {
  const { t } = useTranslation();

  const form = useForm({
    initialValues: {
      rows: [{ label: t('onboarding.income.defaultRows.primarySalary'), amountShekels: '' }],
    },
    validate: {
      rows: {
        label: (value) => (value.trim().length > 0 ? null : t('onboarding.income.errors.labelRequired')),
        amountShekels: (value) => (Number(value) > 0 ? null : t('onboarding.income.errors.amountInvalid')),
      },
    },
  });

  const totalAgorot = form.values.rows.reduce(
    (sum, row) => sum + (Number(row.amountShekels) > 0 ? shekelsToAgorot(Number(row.amountShekels)) : 0),
    0
  );

  const handleSubmit = form.onSubmit((values) => {
    onNext(
      values.rows.map((row) => ({
        label: row.label.trim(),
        amount_agorot: shekelsToAgorot(Number(row.amountShekels)),
      }))
    );
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">{t('onboarding.income.heading')}</p>

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

      <div className="flex justify-end mt-2">
        <Button type="submit" variant="filled" color="accent" size="lg">
          {t('onboarding.income.continue')}
          <Icon name="chevronRight" size="sm" className="ms-1" />
        </Button>
      </div>
    </form>
  );
}
