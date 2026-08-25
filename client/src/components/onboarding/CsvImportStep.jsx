import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, EmptyState, FileInput, Icon, Select, Skeleton, Table } from '../ui';
import { useAuth } from '../../context/AuthContext';
import importService from '../../services/importService';
import { toColumnOptions } from '../../utils/csv';
import { formatDate } from '../../utils/date';
import { formatShekels } from '../../utils/money';

const STEP = { SELECT: 'select', UPLOADING: 'uploading', MAPPING: 'mapping' };

// Server error strings, same mapping as ImportPage.jsx — kept in sync there
// since both surfaces call the same /imports/preview endpoint.
const ERROR_KEY_BY_MESSAGE = {
  'validation failed: file too large (max 10MB)': 'csvImport.error.fileTooLarge',
  'validation failed: file must be a CSV': 'csvImport.error.notCsv',
  'validation failed: file could not be parsed as CSV': 'csvImport.error.unparseable',
  'validation failed: file has no rows': 'csvImport.error.noRows',
  'validation failed: unparseable amount': 'csvImport.error.unparseableAmount',
  'validation failed: unparseable date': 'csvImport.error.unparseableDate',
  'validation failed: mapping': 'csvImport.error.mapping',
};

function resolveErrorKey(message) {
  if (ERROR_KEY_BY_MESSAGE[message]) return ERROR_KEY_BY_MESSAGE[message];
  if (message?.startsWith('upstream storage error')) return 'csvImport.error.storage';
  return 'csvImport.error.generic';
}

// Onboarding's 3rd, skippable step (docs/fixes/... none — new addition). Only
// runs /imports/preview itself (upload + AI column detection, same as
// ImportPage.jsx) — the actual /imports/:id/confirm call is deferred to the
// parent's single onboardingMutation, so a failure there still lets income +
// categories save without a partially-applied CSV import in between.
export function CsvImportStep({ onBack, onFinish, isSubmitting, submitError }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [step, setStep] = useState(STEP.SELECT);
  const [file, setFile] = useState(null);
  const [header, setHeader] = useState([]);
  const [importId, setImportId] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [mapping, setMapping] = useState({ date: null, amount: null, description: null });
  const [aiFailed, setAiFailed] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const previewMutation = useMutation({
    mutationFn: (selectedFile) => importService.preview(selectedFile, user.id),
  });

  const handleUpload = async () => {
    if (!file) return;
    setPreviewError('');
    setAiFailed(false);
    setStep(STEP.UPLOADING);

    try {
      const data = await previewMutation.mutateAsync(file);
      setHeader(data.header);
      setImportId(data.importId);
      setPreviewRows(data.previewRows);
      setMapping({
        date: data.detectedMapping.date,
        amount: data.detectedMapping.amount,
        description: data.detectedMapping.description,
      });
      setAiFailed(!data.detectedMapping.date && !data.detectedMapping.amount);
      setStep(STEP.MAPPING);
    } catch (err) {
      setPreviewError(t(resolveErrorKey(err.message)));
      setStep(STEP.SELECT);
    }
  };

  const headerOptions = toColumnOptions(header);
  const canConfirm = Boolean(mapping.date && mapping.amount);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">{t('onboarding.import.heading')}</p>

      {step === STEP.SELECT && (
        <div className="flex flex-col gap-4 max-w-md">
          <FileInput
            label={t('csvImport.select.label')}
            description={t('csvImport.select.hint')}
            accept=".csv,text/csv"
            value={file}
            onChange={setFile}
          />
          {previewError && <Alert>{previewError}</Alert>}
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
        <div className="flex flex-col gap-4">
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
        </div>
      )}

      {submitError && <Alert>{submitError}</Alert>}

      <div className="flex justify-between gap-3 mt-2">
        <Button type="button" variant="outline" color="gray" size="lg" onClick={onBack} disabled={isSubmitting}>
          {t('onboarding.import.back')}
        </Button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="subtle"
            color="gray"
            size="lg"
            loading={isSubmitting}
            onClick={() => onFinish(null)}
          >
            {t('onboarding.import.skip')}
          </Button>
          {step === STEP.SELECT && (
            <Button type="button" variant="filled" color="accent" size="lg" disabled={!file} onClick={handleUpload}>
              {t('csvImport.select.submit')}
            </Button>
          )}
          {step === STEP.MAPPING && (
            <Button
              type="button"
              variant="filled"
              color="accent"
              size="lg"
              disabled={!canConfirm}
              loading={isSubmitting}
              onClick={() => onFinish({ importId, mapping })}
            >
              <Icon name="check" size="sm" className="me-1" />
              {t('onboarding.import.finish')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
