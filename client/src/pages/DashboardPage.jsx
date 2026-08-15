import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui';
import { AddEnvelopeModal } from '../components/envelopes/AddEnvelopeModal';
import { EnvelopeCard } from '../components/envelopes/EnvelopeCard';
import { SummaryBar } from '../components/envelopes/SummaryBar';
import { QuickEntryModal } from '../components/transactions/QuickEntryModal';
import { useAuth } from '../context/AuthContext';
import envelopeService from '../services/envelopeService';
import transactionService from '../services/transactionService';
import { getCurrentMonth } from '../utils/month';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const month = getCurrentMonth();
  const queryKey = ['envelopes', user.id, month];

  const { data: envelopes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => envelopeService.list(user.id, month),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => envelopeService.create(user.id, { ...payload, month }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => envelopeService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => envelopeService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const quickEntryMutation = useMutation({
    mutationFn: (payload) => transactionService.create(user.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['transactions', user.id, month] });
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">{t('dashboard.title')}</h1>
        <div className="flex items-center gap-4">
          <Link to="/transactions" className="text-sm text-text-secondary hover:text-text-primary">
            {t('nav.transactions')}
          </Link>
          <Link to="/imports" className="text-sm text-text-secondary hover:text-text-primary">
            {t('csvImport.title')}
          </Link>
          <Link to="/planned-expenses" className="text-sm text-text-secondary hover:text-text-primary">
            {t('plannedExpenses.title')}
          </Link>
          <Link to="/settings" className="text-sm text-text-secondary hover:text-text-primary">
            {t('calendar.title')}
          </Link>
          <Button variant="outline" color="gray" size="md" onClick={logout}>
            {t('nav.logout')}
          </Button>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <Button variant="filled" color="accent" onClick={() => setIsAddOpen(true)}>
          {t('dashboard.addEnvelope')}
        </Button>
        <Button variant="outline" color="accent" onClick={() => setIsQuickEntryOpen(true)}>
          {t('dashboard.quickAdd')}
        </Button>
      </div>

      {isLoading && <p className="text-text-secondary mt-6">{t('dashboard.loading')}</p>}

      {!isLoading && envelopes.length > 0 && (
        <div className="mt-6">
          <SummaryBar envelopes={envelopes} />
        </div>
      )}

      {!isLoading && envelopes.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center mt-16 gap-4">
          <p className="text-text-secondary">{t('dashboard.empty')}</p>
          <Button variant="filled" color="accent" onClick={() => setIsAddOpen(true)}>
            {t('dashboard.addFirstEnvelope')}
          </Button>
        </div>
      )}

      {!isLoading && envelopes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {envelopes.map((envelope) => (
            <EnvelopeCard
              key={envelope.id}
              envelope={envelope}
              onDelete={(id) => deleteMutation.mutateAsync(id)}
              onEdit={(id, payload) => updateMutation.mutateAsync({ id, payload })}
            />
          ))}
        </div>
      )}

      <AddEnvelopeModal
        opened={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={(payload) => createMutation.mutateAsync(payload)}
      />

      <QuickEntryModal
        opened={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
        onConfirm={(payload) => quickEntryMutation.mutateAsync(payload)}
      />
    </div>
  );
}
