import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { Button, Card, TextInput } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    initialValues: { email: '', password: '', confirmPassword: '' },
    validateInputOnBlur: true,
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : t('auth.validation.emailInvalid')),
      password: (value) => (value.length >= 8 ? null : t('auth.validation.passwordMinLength')),
      confirmPassword: (value, values) =>
        value === values.password ? null : t('auth.validation.passwordsMismatch'),
    },
  });

  const handleSubmit = async (values) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const { token, user } = await authService.register({
        email: values.email,
        password: values.password,
      });
      login({ token, user });
      navigate('/dashboard');
    } catch (err) {
      setSubmitError(err.message === 'duplicate' ? t('auth.register.errorDuplicate') : err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page px-8 py-9">
      <Card padding={0} className="w-full max-w-md bg-bg-surface border border-border-card rounded-lg">
        <div className="px-6 py-5">
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary mb-7">
            {t('auth.register.title')}
          </h1>
          <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
            <TextInput
              label={t('auth.emailLabel')}
              placeholder={t('auth.emailPlaceholder')}
              required
              {...form.getInputProps('email')}
            />
            <TextInput
              label={t('auth.passwordLabel')}
              type="password"
              placeholder={t('auth.register.passwordPlaceholder')}
              required
              {...form.getInputProps('password')}
            />
            <TextInput
              label={t('auth.register.confirmPasswordLabel')}
              type="password"
              placeholder={t('auth.register.confirmPasswordPlaceholder')}
              required
              {...form.getInputProps('confirmPassword')}
            />
            {submitError && (
              <p className="text-sm text-form-error" role="alert">
                {submitError}
              </p>
            )}
            <Button type="submit" variant="filled" color="accent" size="md" loading={isSubmitting} className="mt-6">
              {t('auth.register.submit')}
            </Button>
          </form>
          <p className="text-base text-text-secondary mt-6">
            {t('auth.register.haveAccount')}{' '}
            <Link to="/login" className="text-accent font-medium">
              {t('auth.register.loginLink')}
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
