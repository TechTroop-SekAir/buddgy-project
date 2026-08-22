import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Icon, SelectableCard, TextInput } from '../ui';

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

// Icon/accent pairing keyed by the stable English suggestion key, not the
// localized label — getCategoryIconName()/getCategoryAccentIndex() in
// utils/categoryIcon.js look up English category names and would return the
// generic "wallet"/fallback accent for every Hebrew label here.
const CATEGORY_META = {
  housing: { icon: 'home', accent: 5 },
  utilities: { icon: 'zap', accent: 3 },
  transport: { icon: 'car', accent: 4 },
  insurance: { icon: 'shield', accent: 1 },
  dailyLiving: { icon: 'shoppingCart', accent: 1 },
  selfCare: { icon: 'sparkles', accent: 3 },
  debtsAndLoans: { icon: 'creditCard', accent: 2 },
  savings: { icon: 'piggyBank', accent: 6 },
  events: { icon: 'partyPopper', accent: 5 },
  vacations: { icon: 'plane', accent: 1 },
  general: { icon: 'wallet', accent: 0 },
};

export function CategoriesStep({ onBack, onFinish, isSubmitting, submitError }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState([]);
  const [housingCustomLabel, setHousingCustomLabel] = useState('');

  const isSelectAllChecked = selected.length === CATEGORY_KEYS.length;

  const toggleSelectAll = () => setSelected(isSelectAllChecked ? [] : [...CATEGORY_KEYS]);
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

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">
          {t('onboarding.categories.selectedCount', { count: selected.length })}
        </span>
        <Button type="button" variant="subtle" color="accent" size="sm" onClick={toggleSelectAll}>
          {t(isSelectAllChecked ? 'onboarding.categories.deselectAll' : 'onboarding.categories.selectAll')}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORY_KEYS.map((key) => {
          const label = t(CATEGORY_LABEL_KEYS[key]);
          const meta = CATEGORY_META[key];
          const checked = selected.includes(key);
          return (
            <SelectableCard
              key={key}
              label={label}
              iconName={meta.icon}
              accentIndex={meta.accent}
              checked={checked}
              onChange={() => toggleCategory(key)}
            >
              {key === 'housing' && checked && (
                <TextInput
                  className="w-full"
                  size="xs"
                  placeholder={`${t('onboarding.categories.suggestions.housing.options.rent')} / ${t(
                    'onboarding.categories.suggestions.housing.options.mortgage'
                  )}`}
                  value={housingCustomLabel}
                  onChange={(e) => setHousingCustomLabel(e.currentTarget.value)}
                />
              )}
            </SelectableCard>
          );
        })}
      </div>

      {submitError && <Alert>{submitError}</Alert>}

      <div className="flex justify-end gap-3 mt-2">
        <Button type="button" variant="outline" color="gray" size="lg" onClick={onBack} disabled={isSubmitting}>
          {t('onboarding.categories.back')}
        </Button>
        <Button type="button" variant="filled" color="accent" size="lg" loading={isSubmitting} onClick={handleFinish}>
          <Icon name="check" size="sm" className="me-1" />
          {t('onboarding.categories.finish')}
        </Button>
      </div>
    </div>
  );
}
