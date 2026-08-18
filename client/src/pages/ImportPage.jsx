import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, EmptyState, FileInput, Select, Skeleton, Table } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import importService from '../services/importService';
import { getCurrentMonth } from '../utils/month';
import { formatDate } from '../utils/date';
import { formatShekels } from '../utils/money';
import { PageHeader } from '../components/shared/PageHeader';

const STEP = { SELECT: 'select', UPLOADING: 'uploading', MAPPING: 'mapping', DONE: 'done' };

// Server error strings (docs/API.md § CSV Import, server/services/csvImportService.js)
// mapped to translation keys — never surface a raw server string.
const ERROR_KEY_BY_MESSAGE = {
  'validation failed: file too large (max 10MB)': 'csvImport.error.fileTooLarge',
  'validation failed: file must be a CSV': 'csvImport.error.notCsv',
  'validation failed: file could not be parsed as CSV': 'csvImport.error.unparseable',
  'validation failed: file has no rows': 'csvImport.error.noRows',
  'validation failed: unparseable amount': 'csvImport.error.unparseableAmount',
  'validation failed: unparseable date': 'csvImport.error.unparseableDate',
  'validation failed: mapping': 'csvImport.error.mapping',
  'unprocessable: ai parse failed': 'csvImport.error.aiFailed',
};

function resolveErrorKey(message) {
  if (ERROR_KEY_BY_MESSAGE[message]) return ERROR_KEY_BY_MESSAGE[message];
  if (message?.startsWith('upstream storage error')) return 'csvImport.error.storage';
  return 'csvImport.error.generic';
}

export function ImportPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const month = getCurrentMonth();

  const [step, setStep] = useState(STEP.SELECT);
  const [file, setFile] = useState(null);
  const [header, setHeader] = useState([]);
  const [importId, setImportId] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [mapping, setMapping] = useState({ date: null, amount: null, description: null });
  const [aiFailed, setAiFailed] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep(STEP.SELECT);
    setFile(null);
    setHeader([]);
    setImportId(null);
    setPreviewRows([]);
    setMapping({ date: null, amount: null, description: null });
    setAiFailed(false);
    setError('');
    setResult(null);
  };

  const previewMutation = useMutation({
    mutationFn: (selectedFile) => importService.preview(selectedFile, user.id),
  });

  const confirmMutation = useMutation({
    mutationFn: () => importService.confirm(importId, mapping, user.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', user.id, month] });
      queryClient.invalidateQueries({ queryKey: ['categories', user.id, month] });
      // Imported rows are new transactions, which change actual spend that
      // the forecast depends on (docs/STATE.md's staleness rule).
      queryClient.invalidateQueries({ queryKey: ['forecast', user.id, month] });
      setResult(data);
      setStep(STEP.DONE);
    },
    onError: (err) => setError(t(resolveErrorKey(err.message))),
  });

  const readHeader = async (selectedFile) => {
    const text = await selectedFile.text();
    const firstLine = text.split(/\r\n|\n|\r/).find((line) => line.trim() !== '') || '';
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    return firstLine.split(delimiter).map((cell) => cell.trim());
  };

  const handleUpload = async () => {
    if (!file) return;
    setError('');
    setAiFailed(false);
    setStep(STEP.UPLOADING);

    try {
      const parsedHeader = await readHeader(file);
      const data = await previewMutation.mutateAsync(file);
      setHeader(parsedHeader);
      setImportId(data.importId);
      setPreviewRows(data.previewRows);
      setMapping({
        date: data.detectedMapping.date,
        amount: data.detectedMapping.amount,
        description: data.detectedMapping.description,
      });
      setStep(STEP.MAPPING);
    } catch (err) {
      if (resolveErrorKey(err.message) === 'csvImport.error.aiFailed') {
        setAiFailed(true);
        setHeader(await readHeader(file));
        setMapping({ date: null, amount: null, description: null });
        setPreviewRows([]);
        setStep(STEP.MAPPING);
      } else {
        setError(t(resolveErrorKey(err.message)));
        setStep(STEP.SELECT);
      }
    }
  };

  const headerOptions = header.map((name) => ({ value: name, label: name }));
  const canConfirm = Boolean(mapping.date && mapping.amount);

  return (
    <>
      <PageHeader />
      <div className="p-8">
      <h1 className="text-2xl font-semibold text-text-primary">{t('csvImport.title')}</h1>

      {step === STEP.SELECT && (
        <div className="flex flex-col gap-4 mt-6 max-w-md">
          <FileInput
            label={t('csvImport.select.label')}
            description={t('csvImport.select.hint')}
            accept=".csv,text/csv"
            value={file}
            onChange={setFile}
          />
          {error && <Alert>{error}</Alert>}
          <Button variant="filled" color="accent" disabled={!file} onClick={handleUpload}>
            {t('csvImport.select.submit')}
          </Button>
        </div>
      )}

      {step === STEP.UPLOADING && (
        <div className="flex flex-col items-center gap-3 py-16 text-center" aria-label={t('csvImport.uploading.title')}>
          <p className="text-base font-medium text-text-primary">{t('csvImport.uploading.title')}</p>
          <p className="text-sm text-text-secondary">{t('csvImport.uploading.body')}</p>
          <Skeleton height={12} width={220} radius="sm" className="mt-2" />
        </div>
      )}

      {step === STEP.MAPPING && (
        <div className="flex flex-col gap-4 mt-6">
          <p className="text-base font-medium text-text-primary">{t('csvImport.mapping.title')}</p>

          {aiFailed && (
            <p className="text-sm text-status-warning" role="alert">
              {t('csvImport.error.aiFailed')}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <Select
                label={t('csvImport.mapping.dateLabel')}
                data={headerOptions}
                value={mapping.date}
                onChange={(value) => setMapping((prev) => ({ ...prev, date: value }))}
                clearable
              />
              {!mapping.date && <Badge color="gray">{t('csvImport.mapping.notDetected')}</Badge>}
            </div>
            <div className="flex flex-col gap-1">
              <Select
                label={t('csvImport.mapping.amountLabel')}
                data={headerOptions}
                value={mapping.amount}
                onChange={(value) => setMapping((prev) => ({ ...prev, amount: value }))}
                clearable
              />
              {!mapping.amount && <Badge color="gray">{t('csvImport.mapping.notDetected')}</Badge>}
            </div>
            <Select
              label={t('csvImport.mapping.descriptionLabel')}
              placeholder={t('csvImport.mapping.descriptionNone')}
              data={headerOptions}
              value={mapping.description}
              onChange={(value) => setMapping((prev) => ({ ...prev, description: value ?? null }))}
              clearable
            />
          </div>

          {previewRows.length === 0 && !aiFailed && <EmptyState message={t('csvImport.mapping.noPreviewRows')} />}

          {previewRows.length > 0 && (
            <div className="mt-2 overflow-x-auto">
              <p className="text-sm font-medium text-text-primary mb-2">{t('csvImport.mapping.previewTitle')}</p>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th className="text-start">{t('csvImport.mapping.dateHeader')}</Table.Th>
                    <Table.Th className="text-end">{t('csvImport.mapping.amountHeader')}</Table.Th>
                    <Table.Th className="text-start">{t('csvImport.mapping.descriptionHeader')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {previewRows.map((row, index) => (
                    <Table.Tr key={index}>
                      <Table.Td className="text-start">
                        {row.transaction_date ? formatDate(row.transaction_date) : '—'}
                      </Table.Td>
                      <Table.Td className="text-end">
                        {row.amount_agorot != null ? formatShekels(row.amount_agorot) : '—'}
                      </Table.Td>
                      <Table.Td className="text-start">{row.description ?? '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}

          {error && <Alert>{error}</Alert>}

          <div className="flex justify-end gap-3 mt-2">
            <Button type="button" variant="outline" color="gray" onClick={reset}>
              {t('csvImport.mapping.back')}
            </Button>
            <Button
              type="button"
              variant="filled"
              color="accent"
              disabled={!canConfirm}
              loading={confirmMutation.isPending}
              onClick={() => {
                setError('');
                confirmMutation.mutate();
              }}
            >
              {t('csvImport.mapping.confirm')}
            </Button>
          </div>
        </div>
      )}

      {step === STEP.DONE && result && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-lg font-semibold text-text-primary">{t('csvImport.done.title')}</p>
          <p className="text-text-secondary">
            {t('csvImport.done.summary', {
              count: result.imported,
              imported: result.imported,
              duplicatesSkipped: result.duplicatesSkipped,
            })}
          </p>
          <p className="text-sm text-text-secondary max-w-md">{t('csvImport.done.unassignedNote')}</p>
          <div className="flex gap-3">
            <Button variant="outline" color="gray" onClick={reset}>
              {t('csvImport.done.importAnother')}
            </Button>
            <Button variant="filled" color="accent" component={Link} to="/transactions">
              {t('csvImport.done.viewTransactions')}
            </Button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
