import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Alert, Button, Icon, TextInput } from '../components/ui';
import { AuthLayout } from '../components/layout/AuthLayout';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import { getErrorMessage } from '../utils/errorMessages';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

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
      setSubmitError(getErrorMessage(err.message, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <p className="text-base text-text-secondary">
          {t('auth.register.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-accent">
            {t('auth.register.loginLink')}
          </Link>
        </p>
      }
    >
      <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
        <TextInput
          label={t('auth.emailLabel')}
          placeholder={t('auth.emailPlaceholder')}
          leftSection={<Icon name="mail" size="sm" />}
          required
          {...form.getInputProps('email')}
        />
        <TextInput
          label={t('auth.passwordLabel')}
          type={passwordVisible ? 'text' : 'password'}
          placeholder={t('auth.register.passwordPlaceholder')}
          leftSection={<Icon name="lock" size="sm" />}
          rightSection={
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t(passwordVisible ? 'auth.hidePassword' : 'auth.showPassword')}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              <Icon name={passwordVisible ? 'eyeOff' : 'eye'} size="sm" />
            </ActionIcon>
          }
          required
          {...form.getInputProps('password')}
        />
        <TextInput
          label={t('auth.register.confirmPasswordLabel')}
          type={passwordVisible ? 'text' : 'password'}
          placeholder={t('auth.register.confirmPasswordPlaceholder')}
          leftSection={<Icon name="lock" size="sm" />}
          required
          {...form.getInputProps('confirmPassword')}
        />
        {submitError && <Alert>{submitError}</Alert>}
        <Button type="submit" variant="filled" color="accent" size="lg" loading={isSubmitting} className="mt-6 w-full">
          {t('auth.register.submit')}
        </Button>
      </form>
    </AuthLayout>
  );
}
