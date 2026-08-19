import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Stepper } from '../ui';
import { getErrorMessage } from '../../utils/errorMessages';
import { IncomeStep } from './IncomeStep';
import { CategoriesStep } from './CategoriesStep';

const STEP = { INCOME: 'income', CATEGORIES: 'categories' };

// Non-dismissible by design — `opened` is derived directly from
// user.onboarding_completed_at === null (see DashboardPage.jsx), so the only
// way out is finishing. Otherwise a closable modal would just reopen on the
// next render since nothing would ever mark onboarding complete.
export function OnboardingWizardModal({ opened, onFinish }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(STEP.INCOME);
  const [incomeRows, setIncomeRows] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleIncomeNext = (rows) => {
    setIncomeRows(rows);
    setStep(STEP.CATEGORIES);
  };

  const handleCategoriesFinish = async (selectedCategories) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onFinish({ incomeRows, selectedCategories });
    } catch (err) {
      setSubmitError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      title={t('onboarding.title')}
    >
      <Stepper active={step === STEP.INCOME ? 0 : 1} className="mb-4">
        <Stepper.Step label={t('onboarding.steps.income')} />
        <Stepper.Step label={t('onboarding.steps.categories')} />
      </Stepper>

      {step === STEP.INCOME && <IncomeStep onNext={handleIncomeNext} />}

      {step === STEP.CATEGORIES && (
        <CategoriesStep
          onBack={() => setStep(STEP.INCOME)}
          onFinish={handleCategoriesFinish}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      )}
    </Modal>
  );
}
