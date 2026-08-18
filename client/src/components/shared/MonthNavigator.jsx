import { useTranslation } from 'react-i18next';
import { Button } from '../ui';
import { getMonthLabel } from '../../utils/date';
import { getCurrentMonth } from '../../utils/month';
import { useLocale } from '../../context/LocaleContext';
import { useMonth } from '../../context/MonthContext';

export function MonthNavigator() {
  const { t } = useTranslation();
  const { direction } = useLocale();
  const { month, goToPreviousMonth, goToNextMonth, goToCurrentMonth } = useMonth();
  // Chevrons are directional glyphs, not text — "previous" must point toward
  // the start of reading order, which flips with RTL, so pick the glyph
  // rather than translate it.
  const prevGlyph = direction === 'rtl' ? '→' : '←';
  const nextGlyph = direction === 'rtl' ? '←' : '→';
  const isCurrentMonth = month === getCurrentMonth();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="subtle"
        color="gray"
        size="md"
        className="px-2 py-1 text-text-secondary hover:text-text-primary"
        onClick={goToPreviousMonth}
        aria-label={t('monthNavigator.prev')}
      >
        {prevGlyph}
      </Button>
      <p className="text-lg font-semibold text-text-primary min-w-[10rem] text-center">{getMonthLabel(month)}</p>
      <Button
        type="button"
        variant="subtle"
        color="gray"
        size="md"
        className="px-2 py-1 text-text-secondary hover:text-text-primary"
        onClick={goToNextMonth}
        aria-label={t('monthNavigator.next')}
      >
        {nextGlyph}
      </Button>
      {!isCurrentMonth && (
        <Button type="button" variant="outline" color="gray" size="md" onClick={goToCurrentMonth}>
          {t('monthNavigator.currentMonth')}
        </Button>
      )}
    </div>
  );
}
