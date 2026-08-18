import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Card, Modal } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import calendarService from '../services/calendarService';
import { PageHeader } from '../components/shared/PageHeader';

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
    <>
      <PageHeader />
      <div className="p-8">
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
    </>
  );
}
