import { useEffect, useRef, useState } from 'react';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Collapse, Icon, Modal, Skeleton } from '../ui';
import { IncomeRowsFields, incomeRowsValidation, toIncomeRowsPayload } from './IncomeRowsFields';
import { useAuth } from '../../context/AuthContext';
import { useMonth } from '../../context/MonthContext';
import incomeService from '../../services/incomeService';
import { agorotToShekels, formatShekelsRounded } from '../../utils/money';
import { getMonthLabel } from '../../utils/date';
import { getErrorMessage } from '../../utils/errorMessages';

const EMPTY_ROW = { label: '', amountShekels: '' };

function toFormRows(rows) {
  if (!rows || rows.length === 0) return [EMPTY_ROW];
  return rows.map((row) => ({ label: row.label, amountShekels: String(agorotToShekels(row.amount_agorot)) }));
}

// Settings' income editor — the only place income can be changed after
// onboarding (previously write-once, see IncomeStep.jsx). Edits whichever
// month is currently selected via the header's month navigator, using the
// same repeatable-row fields as onboarding (IncomeRowsFields) so the two
// forms can't drift. Queries with fallback=previous so a month with no rows
// yet arrives prefilled from the most recent earlier month instead of blank
// — see server/services/incomeSourceService.js.
export function IncomeSettingsCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { month } = useMonth();
  const queryClient = useQueryClient();
  const [saveNotice, setSaveNotice] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const seededMonthRef = useRef(null);

  const queryKey = ['income-sources', user.id, month, 'editable'];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => incomeService.list(user.id, month, 'previous'),
  });

  const form = useForm({
    initialValues: { rows: [EMPTY_ROW] },
    validate: { rows: incomeRowsValidation(t) },
  });

  // Re-seed once per month, when its data arrives — not on every background
  // refetch, so an in-progress edit isn't clobbered. See
  // TransactionEditModal.jsx for the same setValues+resetDirty pattern,
  // adapted here for a query-driven month switch instead of a modal open.
  useEffect(() => {
    if (!data || seededMonthRef.current === month) return;
    form.setValues({ rows: toFormRows(data.rows) });
    form.resetDirty();
    seededMonthRef.current = month;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, month]);

  const invalidateAfterChange = () => {
    // income changed ⇒ the Dashboard's plain income read, the planned-
    // savings figure, and the forecast (docs/STATE.md staleness rule,
    // same as SettingsPage's calendar sync mutation) are all stale.
    queryClient.invalidateQueries({ queryKey: ['income-sources', user.id, month] });
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
  };

  const saveMutation = useMutation({
    mutationFn: (rows) => incomeService.replace(user.id, month, rows),
    onSuccess: (result) => {
      setSaveNotice(true);
      form.setValues({ rows: toFormRows(result.rows) });
      form.resetDirty();
      invalidateAfterChange();
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    setSaveNotice(false);
    saveMutation.mutate(toIncomeRowsPayload(values.rows));
  });

  const handleClearConfirm = () => {
    setClearOpen(false);
    setSaveNotice(false);
    saveMutation.mutate([]);
  };

  if (isLoading) {
    return (
      <Card className="bg-bg-surface border border-border-card rounded-lg mt-6 max-w-lg">
        <div className="p-6 flex items-center justify-between gap-3">
          <Skeleton height={20} width={160} />
          <Skeleton height={20} width={20} circle />
        </div>
      </Card>
    );
  }

  // Starts collapsed — just the title and this month's total — and only
  // expands into the full row editor on click, so Settings doesn't default
  // to showing the largest card on the page for what's usually a glance-only
  // figure.
  return (
    <Card className="bg-bg-surface border border-border-card rounded-lg mt-6 max-w-lg">
      <div className="p-6 flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-start"
          aria-expanded={expanded}
        >
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t('settings.income.title')}</h2>
            <p className="text-sm text-text-secondary mt-1">
              {isError ? t('settings.income.loadError') : `${formatShekelsRounded(data?.total_agorot ?? 0)} · ${getMonthLabel(month)}`}
            </p>
          </div>
          <Icon
            name="chevronDown"
            size="sm"
            className={`shrink-0 text-text-muted transition-transform duration-fast ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        <Collapse in={expanded && !isError}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {data?.carried_from && (
              <p className="text-sm text-text-secondary">
                {t('settings.income.carriedFrom', { month: getMonthLabel(data.carried_from) })}
              </p>
            )}

            <IncomeRowsFields form={form} />

            {saveMutation.isError && (
              <Alert>{getErrorMessage(saveMutation.error?.message, t)}</Alert>
            )}
            {saveNotice && !saveMutation.isPending && (
              <p className="text-sm text-status-ok" role="status">
                {t('settings.income.saved')}
              </p>
            )}

            <div className="flex items-center justify-between mt-2">
              <Button
                type="button"
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setClearOpen(true)}
                disabled={saveMutation.isPending}
              >
                {t('settings.income.clear')}
              </Button>
              <Button type="submit" variant="filled" color="accent" loading={saveMutation.isPending}>
                {t('settings.income.save')}
              </Button>
            </div>
          </form>
        </Collapse>
      </div>

      <Modal opened={clearOpen} onClose={() => setClearOpen(false)} title={t('settings.income.clearConfirmTitle')}>
        <p className="text-sm text-text-secondary mb-6">
          {t('settings.income.clearConfirmBody', { month: getMonthLabel(month) })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" color="gray" onClick={() => setClearOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button color="status-danger" onClick={handleClearConfirm} loading={saveMutation.isPending}>
            {t('settings.income.clear')}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
