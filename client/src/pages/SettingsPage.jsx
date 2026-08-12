import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Modal } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import calendarService from '../services/calendarService';

// Server error strings from server/services/calendarSyncService.js /
// server/services/googleCalendarService.js, mapped to translation keys —
// never surface a raw server string (client/CLAUDE.md § Async UX Contract).
const ERROR_KEY_BY_MESSAGE = {
  'Google Calendar is not connected.': 'calendar.error.notConnected',
  'Google Calendar access was revoked. Please reconnect.': 'calendar.error.revoked',
  'Google Calendar is rate-limited. Try again shortly.': 'calendar.error.rateLimited',
  'Google Calendar is temporarily unavailable. Try again shortly.': 'calendar.error.unavailable',
};

function resolveErrorKey(message) {
  return ERROR_KEY_BY_MESSAGE[message] || 'calendar.error.generic';
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [callbackNotice, setCallbackNotice] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  // Landing spot for GET /api/calendar/callback's redirect
  // (server/routes/calendar.js): ?calendar=connected | ?calendar=error.
  // Stripped immediately so a refresh doesn't re-show the banner.
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
    mutationFn: () => calendarService.getConnectUrl(user.id),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => calendarService.sync(user.id),
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
    mutationFn: () => calendarService.disconnect(user.id),
    onSuccess: () => {
      setDisconnectOpen(false);
      setSyncResult(null);
      refreshUser();
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">{t('calendar.title')}</h1>
        <Link to="/dashboard" className="text-sm text-text-secondary hover:text-text-primary">
          {t('nav.backToDashboard')}
        </Link>
      </div>

      {callbackNotice === 'success' && (
        <p className="text-sm text-status-ok mt-4" role="status">
          {t('calendar.callbackSuccess')}
        </p>
      )}
      {callbackNotice === 'error' && (
        <p className="text-sm text-form-error mt-4" role="alert">
          {t('calendar.callbackError')}
        </p>
      )}

      <Card className="bg-bg-surface border border-border-card rounded-lg mt-6 max-w-lg">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">{t('calendar.title')}</h2>
            {user.connected && <Badge color="status-ok">{t('calendar.connected')}</Badge>}
          </div>

          {!user.connected && (
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
            </>
          )}

          {user.connected && (
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
              {syncError && (
                <p className="text-sm text-form-error" role="alert">
                  {syncError}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="filled"
                  color="accent"
                  loading={syncMutation.isPending}
                  onClick={() => syncMutation.mutate()}
                >
                  {syncMutation.isPending ? t('calendar.syncing') : t('calendar.sync')}
                </Button>
                <Button variant="outline" color="status-danger" onClick={() => setDisconnectOpen(true)}>
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
