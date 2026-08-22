import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Icon, Stepper } from '../components/ui';
import { IncomeStep } from '../components/onboarding/IncomeStep';
import { CategoriesStep } from '../components/onboarding/CategoriesStep';
import { useAuth } from '../context/AuthContext';
import { useMonth } from '../context/MonthContext';
import categoryService from '../services/categoryService';
import incomeService from '../services/incomeService';
import authService from '../services/authService';
import { getErrorMessage } from '../utils/errorMessages';

const STEP = { INCOME: 'income', CATEGORIES: 'categories' };
const STEP_NUMBER = { [STEP.INCOME]: 1, [STEP.CATEGORIES]: 2 };
const TOTAL_STEPS = 2;

// Dedicated route (docs/features/HOMEPAGE-FIXES.md § 4.3) rather than a modal
// parked on top of the homepage — new users land here straight from login and
// are sent to the homepage only once onboarding actually finishes; existing
// users never see it (see routes.jsx's redirect on onboarding_completed_at).
export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { month } = useMonth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(STEP.INCOME);
  const [incomeRows, setIncomeRows] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Sequential on purpose: a failed income-save must never leave onboarding
  // marked complete with no income persisted. monthly_budget_agorot: 1 is a
  // placeholder (server rejects 0) — formatShekelsRounded() displays it as
  // ₪0 everywhere, matching the real intent of "no budget set yet."
  const onboardingMutation = useMutation({
    mutationFn: async ({ incomeRows, selectedCategories }) => {
      await incomeService.replace(user.id, month, incomeRows);

      await Promise.all(
        selectedCategories.map((category) =>
          categoryService.create(user.id, { ...category, monthly_budget_agorot: 1, month })
        )
      );

      await authService.completeOnboarding();
      await refreshUser();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['income-sources', user.id, month] });
      navigate('/dashboard', { replace: true });
    },
  });

  const handleIncomeNext = (rows) => {
    setIncomeRows(rows);
    setStep(STEP.CATEGORIES);
  };

  const handleCategoriesFinish = async (selectedCategories) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onboardingMutation.mutateAsync({ incomeRows, selectedCategories });
    } catch (err) {
      setSubmitError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-page">
      <div className="h-0.5 w-full bg-brand-stripe" />
      <div className="flex items-center gap-2.5 px-6 py-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-gradient">
          <Icon name="wallet" size="sm" className="text-bg-surface" />
        </span>
        <span className="text-base font-semibold tracking-tight text-text-primary">{t('common.appName')}</span>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col px-4 pb-16 pt-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{t('onboarding.title')}</h1>
          <span className="text-sm text-text-muted">
            {t('onboarding.stepCounter', { current: STEP_NUMBER[step], total: TOTAL_STEPS })}
          </span>
        </div>
        <p className="mb-6 text-sm text-text-muted">{t('onboarding.subtitle')}</p>

        <Stepper active={step === STEP.INCOME ? 0 : 1} className="mb-6">
          <Stepper.Step label={t('onboarding.steps.income')} />
          <Stepper.Step label={t('onboarding.steps.categories')} />
        </Stepper>

        <div key={step} className="fade-up rounded-lg border border-border-card bg-bg-surface p-6 shadow-md">
          {step === STEP.INCOME && <IncomeStep onNext={handleIncomeNext} />}

          {step === STEP.CATEGORIES && (
            <CategoriesStep
              onBack={() => setStep(STEP.INCOME)}
              onFinish={handleCategoriesFinish}
              isSubmitting={isSubmitting}
              submitError={submitError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
