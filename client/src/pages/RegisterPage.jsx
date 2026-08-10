import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { Button, Card, TextInput } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    initialValues: { email: '', password: '', confirmPassword: '' },
    validateInputOnBlur: true,
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email address'),
      password: (value) => (value.length >= 8 ? null : 'Password must be at least 8 characters'),
      confirmPassword: (value, values) => (value === values.password ? null : 'Passwords do not match'),
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
      setSubmitError(
        err.message === 'duplicate' ? 'An account with this email already exists.' : err.message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page px-8 py-9">
      <Card padding={0} className="w-full max-w-md bg-bg-surface border border-border-card rounded-lg">
        <div className="px-6 py-5">
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary mb-7">Create an account</h1>
          <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
            <TextInput label="Email" placeholder="you@example.com" required {...form.getInputProps('email')} />
            <TextInput
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              required
              {...form.getInputProps('password')}
            />
            <TextInput
              label="Confirm password"
              type="password"
              placeholder="Re-enter your password"
              required
              {...form.getInputProps('confirmPassword')}
            />
            {submitError && (
              <p className="text-sm text-form-error" role="alert">
                {submitError}
              </p>
            )}
            <Button type="submit" variant="filled" color="accent" size="md" loading={isSubmitting} className="mt-6">
              Create account
            </Button>
          </form>
          <p className="text-base text-text-secondary mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent font-medium">
              Log in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
