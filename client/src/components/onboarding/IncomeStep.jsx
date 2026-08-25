import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '../ui';
import { IncomeRowsFields, incomeRowsValidation, toIncomeRowsPayload } from '../income/IncomeRowsFields';

export function IncomeStep({ onNext }) {
  const { t } = useTranslation();

  const form = useForm({
    initialValues: {
      rows: [{ label: t('onboarding.income.defaultRows.primarySalary'), amountShekels: '' }],
    },
    validate: { rows: incomeRowsValidation(t) },
  });

  const handleSubmit = form.onSubmit((values) => {
    onNext(toIncomeRowsPayload(values.rows));
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">{t('onboarding.income.heading')}</p>

      <IncomeRowsFields form={form} />

      <div className="flex justify-end mt-2">
        <Button type="submit" variant="filled" color="accent" size="lg">
          {t('onboarding.income.continue')}
          <Icon name="chevronRight" size="sm" className="ms-1" />
        </Button>
      </div>
    </form>
  );
}
