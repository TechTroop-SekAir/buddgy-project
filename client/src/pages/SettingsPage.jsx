import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Card, Modal } from '../components/ui';
import { UpcomingEventsCard } from '../components/plannedExpenses/UpcomingEventsCard';
import { useAuth } from '../context/AuthContext';
import { useMonth } from '../context/MonthContext';
import calendarService from '../services/calendarService';
import plannedExpenseService from '../services/plannedExpenseService';
import categoryService from '../services/categoryService';

const ERROR_KEY_BY_MESSAGE = {
  'Google Calendar is not connected.': 'calendar.error.notConnected',
  'Google Calendar access was revoked. Please reconnect.': 'calendar.error.revoked',
  'Google Calendar is rate-limited. Try again shortly.': 'calendar.error.rateLimited',
  'Google Calendar is temporarily unavailable. Try again shortly.': 'calendar.error.unavailable',
};

function resolveErrorKey(message) {
  return ERROR_KEY_BY_MESSAGE[message] || 'calendar.error.generic';
}

function checkMockConnected(userId) {
  try {
    const raw = localStorage.getItem('buddgy_mock_calendar_connected');
    const ids = raw ? JSON.parse(raw) : [];
    return ids.includes(userId) || ids.includes(String(userId)) || ids.includes(Number(userId));
  } catch {
    return false;
  }
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { month } = useMonth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [callbackNotice, setCallbackNotice] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [connectError, setConnectError] = useState('');
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectError, setDisconnectError] = useState('');

  const isMock = import.meta.env.VITE_USE_MOCK_CALENDAR === 'true';
  const isCalendarConnected = Boolean(
    user?.connected ||
    user?.is_calendar_connected ||
    (isMock && checkMockConnected(user?.id))
  );

  // Same UpcomingEventsCard shown on /planned-expenses, mounted here too so
  // the user sees it right where they just synced — docs/features/UPCOMING-EVENTS.md.
  // Shares the ['planned-expenses', user.id, month] query key, so the sync
  // mutation's invalidation below (and PlannedExpensesPage's own queries)
  // refresh this for free.
  const plannedExpensesQueryKey = ['planned-expenses', user?.id, month];
  const { data: allPlannedExpenses = [] } = useQuery({
    queryKey: plannedExpensesQueryKey,
    queryFn: () => plannedExpenseService.list(user.id, month, { includeDismissed: true }),
    enabled: Boolean(user?.id) && isCalendarConnected,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', user?.id, month],
    queryFn: () => categoryService.list(user.id, month),
    enabled: Boolean(user?.id) && isCalendarConnected,
  });
  const categoryOptions = categories.map((category) => ({ value: String(category.id), label: category.name }));

  const dismissMutation = useMutation({
    mutationFn: (id) => plannedExpenseService.update(id, { is_dismissed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannedExpensesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['forecast', user?.id, month] });
    },
  });
  const undoDismissMutation = useMutation({
    mutationFn: (id) => plannedExpenseService.update(id, { is_dismissed: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannedExpensesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['forecast', user?.id, month] });
    },
  });
  const spendMutation = useMutation({
    mutationFn: ({ id, payload }) => plannedExpenseService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannedExpensesQueryKey });
      queryClient.invalidateQueries({ queryKey: ['forecast', user?.id, month] });
    },
  });

  useEffect(() => {
    const calendarParam = searchParams.get('calendar');
    if (!calendarParam) return;

    if (calendarParam === 'connected') {
      setCallbackNotice('success');
      refreshUser();
    } else {
      setCallbackNotice('error');
    }

    const next = new URLSearchParams(searchParams);
    next.delete('calendar');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectMutation = useMutation({
    mutationFn: () => calendarService.getConnectUrl(user?.id),
    onSuccess: ({ url }) => {
      setConnectError('');
      window.location.href = url;
    },
    onError: (err) => setConnectError(t(resolveErrorKey(err.message))),
  });

  const syncMutation = useMutation({
    mutationFn: () => calendarService.sync(user?.id),
    onSuccess: (data) => {
      setSyncError('');
      setSyncResult(data.newEvents);
      // Bug fix: this previously invalidated nothing, so newly synced events
      // never showed on /planned-expenses (or the dashboard's missing-amount
      // prompt) until a manual reload. Same keys PlannedExpensesPage.jsx
      // invalidates on its own mutations.
      queryClient.invalidateQueries({ queryKey: ['planned-expenses', user?.id, month] });
      queryClient.invalidateQueries({ queryKey: ['forecast', user?.id, month] });
    },
    onError: (err) => {
      setSyncResult(null);
      setSyncError(t(resolveErrorKey(err.message)));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => calendarService.disconnect(user?.id),
    onSuccess: () => {
      setDisconnectError('');
      setDisconnectOpen(false);
      setSyncResult(null);
      refreshUser();
    },
    onError: (err) => setDisconnectError(t(resolveErrorKey(err.message))),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary">{t('calendar.title')}</h1>

      {callbackNotice === 'success' && (
        <p className="text-sm text-status-ok mt-4" role="status">
          {t('calendar.callbackSuccess')}
        </p>
      )}
      {callbackNotice === 'error' && <Alert className="mt-4">{t('calendar.callbackError')}</Alert>}

      <Card className="bg-bg-surface border border-border-card rounded-lg mt-6 max-w-lg">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">{t('calendar.title')}</h2>
            {isCalendarConnected && <Badge color="status-ok">{t('calendar.connected')}</Badge>}
          </div>

          {!isCalendarConnected && (
            <>
              <p className="text-sm text-text-secondary">{t('calendar.notConnected')}</p>
              <Button
                variant="filled"
                color="accent"
                className="self-start"
                loading={connectMutation.isPending}
                onClick={() => connectMutation.mutate()}
              >
                {t('calendar.connect')}
              </Button>
              {connectError && <Alert>{connectError}</Alert>}
            </>
          )}

          {isCalendarConnected && (
            <>
              <p className="text-sm text-text-secondary">{t('calendar.connectedBody')}</p>

              {syncResult != null &&
                (syncResult > 0 ? (
                  <p className="text-sm text-status-ok" role="status">
                    {t('calendar.syncResult', { count: syncResult })}
                  </p>
                ) : (
                  <p className="text-sm text-text-secondary" role="status">
                    {t('calendar.syncResultZero')}
                  </p>
                ))}
              {syncError && <Alert>{syncError}</Alert>}

              <div className="flex gap-3">
                <Button
                  variant="filled"
                  color="accent"
                  loading={syncMutation.isPending}
                  onClick={() => syncMutation.mutate()}
                >
                  {syncMutation.isPending ? t('calendar.syncing') : t('calendar.sync')}
                </Button>
                <Button
                  variant="outline"
                  color="status-danger"
                  disabled={syncMutation.isPending}
                  onClick={() => {
                    setDisconnectError('');
                    setDisconnectOpen(true);
                  }}
                >
                  {t('calendar.disconnect')}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      {isCalendarConnected && (
        <UpcomingEventsCard
          className="mt-6 max-w-lg"
          plannedExpenses={allPlannedExpenses}
          categoryOptions={categoryOptions}
          onDismiss={(id) => dismissMutation.mutateAsync(id)}
          onUndoDismiss={(id) => undoDismissMutation.mutateAsync(id)}
          onSpend={(id, payload) => spendMutation.mutateAsync({ id, payload })}
        />
      )}

      <Modal
        opened={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        title={t('calendar.disconnectConfirmTitle')}
      >
        <p className="text-sm text-text-secondary mb-6">{t('calendar.disconnectConfirmBody')}</p>
        {disconnectError && <Alert className="mb-4">{disconnectError}</Alert>}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            color="gray"
            onClick={() => setDisconnectOpen(false)}
            disabled={disconnectMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            color="status-danger"
            onClick={() => disconnectMutation.mutate()}
            loading={disconnectMutation.isPending}
          >
            {t('calendar.disconnect')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
