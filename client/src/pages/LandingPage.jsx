import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui';

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="px-8 py-9">
      <h1 className="text-3xl font-semibold tracking-tight text-text-primary">{t('landing.appName')}</h1>
      <p className="text-base text-text-secondary mt-4 mb-7">
        {t('landing.tagline')}
      </p>
      <div className="flex gap-3">
        <Link to="/login">
          <Button variant="filled" color="accent" size="md">
            {t('common.logIn')}
          </Button>
        </Link>
        <Link to="/register">
          <Button variant="outline" color="gray" size="md">
            {t('common.createAccount')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
