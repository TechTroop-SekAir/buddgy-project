import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Icon, Stepper } from '../components/ui';
import { IncomeStep } from '../components/onboarding/IncomeStep';
import { CategoriesStep } from '../components/onboarding/CategoriesStep';
import { CsvImportStep } from '../components/onboarding/CsvImportStep';
import { useAuth } from '../context/AuthContext';
import { useMonth } from '../context/MonthContext';
import categoryService from '../services/categoryService';
import incomeService from '../services/incomeService';
import importService from '../services/importService';
import authService from '../services/authService';
import { getErrorMessage } from '../utils/errorMessages';

const STEP = { INCOME: 'income', CATEGORIES: 'categories', IMPORT: 'import' };
const STEP_NUMBER = { [STEP.INCOME]: 1, [STEP.CATEGORIES]: 2, [STEP.IMPORT]: 3 };
const TOTAL_STEPS = 3;

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
  const [selectedCategories, setSelectedCategories] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Sequential on purpose: a failed income-save must never leave onboarding
  // marked complete with no income persisted. monthly_budget_agorot: 1 is a
  // placeholder (server rejects 0) — formatShekelsRounded() displays it as
  // ₪0 everywhere, matching the real intent of "no budget set yet."
  //
  // csvImport: the file itself was already uploaded and parsed by
  // CsvImportStep (via importService.preview), which just handed back the
  // importId + column mapping — the row-import side effect only happens
  // here, after categories exist, so imported transactions can eventually be
  // assigned to a real envelope. csvImport is null when the user skipped.
  //
  // Re-runnability: income (a real replace) and completeOnboarding (only
  // stamps an unset timestamp) are both naturally idempotent. Category
  // creation isn't — a 409 here means the category already exists from an
  // earlier attempt, which is the state we wanted anyway, so it's tolerated
  // rather than re-thrown. Without this, any failure after categories were
  // created (e.g. a CSV import error) permanently wedged the user: onboarding
  // never completes, OnboardingRoute (routes.jsx) keeps sending them back to
  // this wizard, and every retry 409s on all their categories.
  //
  // The CSV import itself is optional (the step is skippable) and must not
  // cost the user their income + categories if it fails — it's surfaced as a
  // non-blocking notice on the dashboard instead, retryable from /imports.
  const onboardingMutation = useMutation({
    mutationFn: async ({ incomeRows, selectedCategories, csvImport }) => {
      await incomeService.replace(user.id, month, incomeRows);

      await Promise.all(
        selectedCategories.map(async (category) => {
          try {
            await categoryService.create(user.id, { ...category, monthly_budget_agorot: 1, month });
          } catch (err) {
            if (err.status === 409 || err.message === 'duplicate: name') return;
            throw err;
          }
        })
      );

      let csvImportFailed = false;
      if (csvImport) {
        try {
          await importService.confirm(csvImport.importId, csvImport.mapping, user.id);
        } catch {
          csvImportFailed = true;
        }
      }

      await authService.completeOnboarding();
      await refreshUser();
      return { csvImportFailed };
    },
    onSuccess: ({ csvImportFailed }) => {
      queryClient.invalidateQueries({ queryKey: ['categories', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['income-sources', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['transactions', user.id, month] });
      navigate('/dashboard', { replace: true, state: { csvImportFailed } });
    },
  });

  const handleIncomeNext = (rows) => {
    setIncomeRows(rows);
    setStep(STEP.CATEGORIES);
  };

  const handleCategoriesNext = (categories) => {
    setSelectedCategories(categories);
    setStep(STEP.IMPORT);
  };

  const handleImportFinish = async (csvImport) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onboardingMutation.mutateAsync({ incomeRows, selectedCategories, csvImport });
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
          <Icon name="wallet" size="sm" className="text-text-on-fill" />
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

        <Stepper active={STEP_NUMBER[step] - 1} className="mb-6">
          <Stepper.Step label={t('onboarding.steps.income')} />
          <Stepper.Step label={t('onboarding.steps.categories')} />
          <Stepper.Step label={t('onboarding.steps.import')} />
        </Stepper>

        <div key={step} className="fade-up rounded-lg border border-border-card bg-bg-surface p-6 shadow-md">
          {step === STEP.INCOME && <IncomeStep onNext={handleIncomeNext} />}

          {step === STEP.CATEGORIES && (
            <CategoriesStep onBack={() => setStep(STEP.INCOME)} onNext={handleCategoriesNext} />
          )}

          {step === STEP.IMPORT && (
            <CsvImportStep
              onBack={() => setStep(STEP.CATEGORIES)}
              onFinish={handleImportFinish}
              isSubmitting={isSubmitting}
              submitError={submitError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
