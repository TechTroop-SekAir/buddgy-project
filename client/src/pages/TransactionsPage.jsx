import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import transactionService from '../services/transactionService';
import envelopeService from '../services/envelopeService';
import { TransactionFilters, UNASSIGNED_VALUE } from '../components/transactions/TransactionFilters';
import { TransactionRow } from '../components/transactions/TransactionRow';
import { getCurrentMonth } from '../utils/month';
import { shiftMonth } from '../utils/date';
import { formatShekels } from '../utils/money';

export function TransactionsPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());
  const [search, setSearch] = useState('');
  const [envelopeId, setEnvelopeId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', user.id, month],
    queryFn: () => transactionService.list(user.id, month),
  });

  const { data: envelopes = [] } = useQuery({
    queryKey: ['envelopes', user.id, month],
    queryFn: () => envelopeService.list(user.id, month),
  });

  const envelopeOptions = envelopes.map((envelope) => ({ value: envelope.id, label: envelope.name }));
  const envelopeNameById = Object.fromEntries(envelopes.map((envelope) => [envelope.id, envelope.name]));

  const handleMonthChange = (delta) => {
    setMonth((current) => shiftMonth(current, delta));
    setDateFrom('');
    setDateTo('');
  };

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (query && !transaction.description.toLowerCase().includes(query)) return false;

      if (envelopeId === UNASSIGNED_VALUE && transaction.envelope_id) return false;
      if (envelopeId && envelopeId !== UNASSIGNED_VALUE && transaction.envelope_id !== envelopeId) return false;

      if (dateFrom && transaction.transaction_date < dateFrom) return false;
      if (dateTo && transaction.transaction_date > dateTo) return false;

      return true;
    });
  }, [transactions, search, envelopeId, dateFrom, dateTo]);

  const total = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount_agorot, 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Transactions</h1>
        <Link to="/dashboard" className="text-sm text-text-secondary hover:text-text-primary">
          ← Dashboard
        </Link>
      </div>

      <div className="mt-6">
        <TransactionFilters
          month={month}
          onMonthChange={handleMonthChange}
          search={search}
          onSearchChange={setSearch}
          envelopeId={envelopeId}
          onEnvelopeChange={setEnvelopeId}
          envelopeOptions={envelopeOptions}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
        />
      </div>

      {isLoading && <p className="text-text-secondary mt-6">Loading transactions…</p>}

      {!isLoading && transactions.length === 0 && (
        <p className="text-text-secondary mt-16 text-center">You don&apos;t have any transactions yet this month.</p>
      )}

      {!isLoading && transactions.length > 0 && filteredTransactions.length === 0 && (
        <p className="text-text-secondary mt-16 text-center">No transactions match your filters.</p>
      )}

      {!isLoading && filteredTransactions.length > 0 && (
        <>
          <p className="text-sm text-text-secondary mt-6">
            Total: <span className="font-semibold text-text-primary">{formatShekels(total)}</span> across{' '}
            {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? '' : 's'}
          </p>

          <table className="w-full mt-3">
            <thead>
              <tr className="border-b border-border-card text-left text-xs uppercase text-text-secondary">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Description</th>
                <th className="py-2 pr-4 font-medium">Category</th>
                <th className="py-2 pr-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  categoryLabel={
                    transaction.envelope_id
                      ? envelopeNameById[transaction.envelope_id] || 'Uncategorized'
                      : 'Uncategorized'
                  }
                />
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
