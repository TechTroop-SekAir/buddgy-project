import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Modal, NumberInput, Select, Skeleton, Textarea, TextInput } from '../ui';
import { useAuth } from '../../context/AuthContext';
import categoryService from '../../services/categoryService';
import transactionService from '../../services/transactionService';
import { agorotToShekels, shekelsToAgorot } from '../../utils/money';
import { getCurrentMonth } from '../../utils/month';
import { getErrorMessage } from '../../utils/errorMessages';
import { parseQuickEntryText } from '../../utils/parseQuickEntryText';

const MAX_TEXT_LENGTH = 500;
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const DEFAULT_CATEGORY_NAME = 'הוצאות כלליות';
const DEFAULT_CATEGORY_BUDGET_SHEKELS = 1000;

const STEP = { INPUT: 'input', PARSING: 'parsing', REVIEW: 'review' };

// Modal-owned three-step flow (input → parsing → review/confirm) launched
// from DashboardPage, matching CategoryFormModal.jsx's local-state pattern.
// The parse step never saves anything on its own — root CLAUDE.md § External
// Integrations: "never auto-save an AI-parsed transaction."
export function QuickEntryModal({ opened, onClose, onConfirm }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const month = getCurrentMonth();

  const [step, setStep] = useState(STEP.INPUT);
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState('');
  const [review, setReview] = useState(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user.id, month],
    queryFn: () => categoryService.list(user.id, month),
    enabled: opened,
  });
  const categoryOptions = categories.map((category) => ({ value: String(category.id), label: category.name }));

  // No AI service is guaranteed to be available (see claudeService.js) —
  // whenever the AI doesn't return a confident envelope match, or the AI
  // call fails entirely (handleParse's catch branch), fall back to this
  // catch-all category instead of leaving the transaction unclassified.
  // Auto-created on first use so the flow never blocks on missing setup.
  async function resolveDefaultCategoryId() {
    try {
      const existing = categories.find((category) => category.name === DEFAULT_CATEGORY_NAME);
      if (existing) return String(existing.id);

      const created = await categoryService.create(user.id, {
        name: DEFAULT_CATEGORY_NAME,
        monthly_budget_agorot: shekelsToAgorot(DEFAULT_CATEGORY_BUDGET_SHEKELS),
        month,
      });
      queryClient.invalidateQueries({ queryKey: ['categories', user.id, month] });
      return String(created.id);
    } catch {
      // Backend also unreachable — degrade to the existing "no category
      // suggested" state rather than blocking the whole parse.
      return '';
    }
  }

  const reset = () => {
    setStep(STEP.INPUT);
    setText('');
    setParseError('');
    setReview(null);
    setAiUnavailable(false);
    setSubmitError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleParse = async () => {
    setParseError('');
    setAiUnavailable(false);
    setStep(STEP.PARSING);
    try {
      const result = await transactionService.parse(text.trim(), user.id);
      const envelopeId =
        result.suggested_envelope_id != null
          ? String(result.suggested_envelope_id)
          : await resolveDefaultCategoryId();
      setReview({
        amountShekels: String(agorotToShekels(result.amount_agorot)),
        description: result.description,
        transactionDate: result.transaction_date,
        envelopeId,
        confidence: result.confidence,
      });
      setStep(STEP.REVIEW);
    } catch {
      // AI unreachable/failed/timed out — this flow has no hard AI
      // dependency, so fall back to local parsing rather than blocking.
      // The user still needs to know the AI path didn't run, hence
      // aiUnavailable below (rendered as a notice on the review step).
      const local = parseQuickEntryText(text.trim());
      if (!local) {
        setParseError(t('quickEntry.error.noAmount'));
        setStep(STEP.INPUT);
        return;
      }
      setAiUnavailable(true);
      setReview({
        amountShekels: String(local.amountShekels),
        description: local.description,
        transactionDate: new Date().toISOString().slice(0, 10),
        envelopeId: await resolveDefaultCategoryId(),
      });
      setStep(STEP.REVIEW);
    }
  };

  const handleConfirm = async () => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onConfirm({
        envelope_id: review.envelopeId ? Number(review.envelopeId) : null,
        amount_agorot: shekelsToAgorot(Number(review.amountShekels)),
        description: review.description.trim(),
        transaction_date: review.transactionDate,
      });
      reset();
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLowConfidence = review && review.confidence < LOW_CONFIDENCE_THRESHOLD;
  const hasNoEnvelope = review && !review.envelopeId;
  const selectedCategoryName = review
    ? categories.find((category) => String(category.id) === review.envelopeId)?.name ?? t('transactions.uncategorized')
    : '';

  return (
    <Modal opened={opened} onClose={handleClose} title={t('quickEntry.modalTitle')}>
      {step === STEP.INPUT && (
        <div className="flex flex-col gap-4">
          <Textarea
            label={t('quickEntry.input.label')}
            placeholder={t('quickEntry.input.placeholder')}
            autosize
            minRows={3}
            maxLength={MAX_TEXT_LENGTH}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
          />
          <p className="text-xs text-text-secondary text-end">
            {t('quickEntry.input.charCount', { count: text.length, max: MAX_TEXT_LENGTH })}
          </p>
          {parseError && <Alert>{parseError}</Alert>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" color="gray" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="filled"
              color="accent"
              disabled={!text.trim()}
              loading={step === STEP.PARSING}
              onClick={handleParse}
            >
              {t('quickEntry.input.submit')}
            </Button>
          </div>
        </div>
      )}

      {step === STEP.PARSING && (
        <div className="flex flex-col items-center gap-3 py-8 text-center" aria-label={t('quickEntry.parsing.title')}>
          <p className="text-base font-medium text-text-primary">{t('quickEntry.parsing.title')}</p>
          <p className="text-sm text-text-secondary">{t('quickEntry.parsing.body')}</p>
          <Skeleton height={12} width={220} radius="sm" className="mt-2" />
        </div>
      )}

      {step === STEP.REVIEW && review && (
        <div className="flex flex-col gap-4">
          <p className="text-base font-medium text-text-primary">{t('quickEntry.review.title')}</p>
          <Badge color="gray" className="self-start">
            {t('quickEntry.review.categoryBadge', { category: selectedCategoryName })}
          </Badge>

          {aiUnavailable && (
            <p className="text-sm text-status-warning" role="alert">
              {t('quickEntry.review.aiUnavailableNotice')}
            </p>
          )}

          {isLowConfidence && (
            <p className="text-sm text-status-warning" role="alert">
              {t('quickEntry.review.lowConfidenceWarning')}
            </p>
          )}

          <NumberInput
            label={t('quickEntry.review.amountLabel')}
            leftSection="₪"
            min={0}
            value={review.amountShekels}
            onChange={(value) => setReview((prev) => ({ ...prev, amountShekels: String(value) }))}
          />
          <TextInput
            label={t('quickEntry.review.descriptionLabel')}
            value={review.description}
            onChange={(e) => setReview((prev) => ({ ...prev, description: e.currentTarget.value }))}
          />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-primary">{t('quickEntry.review.dateLabel')}</span>
            <input
              type="date"
              className="rounded-sm border border-border-card bg-bg-surface px-3 py-2 text-sm text-text-primary"
              value={review.transactionDate}
              onChange={(e) => setReview((prev) => ({ ...prev, transactionDate: e.target.value }))}
            />
          </label>
          <Select
            label={t('quickEntry.review.envelopeLabel')}
            placeholder={t('quickEntry.review.envelopeNone')}
            data={categoryOptions}
            value={review.envelopeId || null}
            onChange={(value) => setReview((prev) => ({ ...prev, envelopeId: value ?? '' }))}
            clearable
          />
          {hasNoEnvelope && (
            <p className="text-sm text-status-warning" role="alert">
              {t('quickEntry.review.noEnvelopeWarning')}
            </p>
          )}

          {submitError && <Alert>{submitError}</Alert>}

          <div className="flex justify-end gap-3 mt-2">
            <Button type="button" variant="outline" color="gray" onClick={() => setStep(STEP.INPUT)}>
              {t('quickEntry.review.back')}
            </Button>
            <Button type="button" variant="filled" color="accent" loading={isSubmitting} onClick={handleConfirm}>
              {t('quickEntry.review.confirm')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
