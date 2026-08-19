import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Checkbox, TextInput } from '../ui';

const CATEGORY_LABEL_KEYS = {
  housing: 'onboarding.categories.suggestions.housing.label',
  utilities: 'onboarding.categories.suggestions.utilities',
  transport: 'onboarding.categories.suggestions.transport',
  insurance: 'onboarding.categories.suggestions.insurance',
  dailyLiving: 'onboarding.categories.suggestions.dailyLiving',
  selfCare: 'onboarding.categories.suggestions.selfCare',
  debtsAndLoans: 'onboarding.categories.suggestions.debtsAndLoans',
  savings: 'onboarding.categories.suggestions.savings',
  events: 'onboarding.categories.suggestions.events',
  vacations: 'onboarding.categories.suggestions.vacations',
  general: 'onboarding.categories.suggestions.general',
};
const CATEGORY_KEYS = Object.keys(CATEGORY_LABEL_KEYS);

export function CategoriesStep({ onBack, onFinish, isSubmitting, submitError }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState([]);
  const [housingCustomLabel, setHousingCustomLabel] = useState('');

  const isSelectAllChecked = selected.length === CATEGORY_KEYS.length;

  const toggleSelectAll = (checked) => setSelected(checked ? [...CATEGORY_KEYS] : []);
  const toggleCategory = (key) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleFinish = () => {
    const selectedCategories = selected.map((key) => ({
      name:
        key === 'housing' && housingCustomLabel.trim()
          ? housingCustomLabel.trim()
          : t(CATEGORY_LABEL_KEYS[key]),
    }));
    onFinish(selectedCategories);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">{t('onboarding.categories.heading')}</p>

      <Checkbox
        label={t(isSelectAllChecked ? 'onboarding.categories.deselectAll' : 'onboarding.categories.selectAll')}
        checked={isSelectAllChecked}
        onChange={(e) => toggleSelectAll(e.currentTarget.checked)}
      />

      <div className="flex flex-col gap-2 ps-1">
        {CATEGORY_KEYS.map((key) => (
          <div key={key}>
            <Checkbox
              label={t(CATEGORY_LABEL_KEYS[key])}
              checked={selected.includes(key)}
              onChange={() => toggleCategory(key)}
            />
            {key === 'housing' && selected.includes('housing') && (
              <TextInput
                className="ms-8 mt-1"
                placeholder={`${t('onboarding.categories.suggestions.housing.options.rent')} / ${t(
                  'onboarding.categories.suggestions.housing.options.mortgage'
                )}`}
                value={housingCustomLabel}
                onChange={(e) => setHousingCustomLabel(e.currentTarget.value)}
              />
            )}
          </div>
        ))}
      </div>

      {submitError && <Alert>{submitError}</Alert>}

      <div className="flex justify-end gap-3 mt-2">
        <Button type="button" variant="outline" color="gray" onClick={onBack} disabled={isSubmitting}>
          {t('onboarding.categories.back')}
        </Button>
        <Button type="button" variant="filled" color="accent" loading={isSubmitting} onClick={handleFinish}>
          {t('onboarding.categories.finish')}
        </Button>
      </div>
    </div>
  );
}
