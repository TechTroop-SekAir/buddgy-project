import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { Button, Card, TextInput } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    initialValues: { email: '', password: '' },
    validateInputOnBlur: true,
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email address'),
      password: (value) => (value.length > 0 ? null : 'Password is required'),
    },
  });

  const handleSubmit = async (values) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const { token, user } = await authService.login(values);
      login({ token, user });
      navigate('/dashboard');
    } catch (err) {
      setSubmitError(err.message === 'unauthorized' ? 'Incorrect email or password.' : err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page px-8 py-9">
      <Card padding={0} className="w-full max-w-md bg-bg-surface border border-border-card rounded-lg">
        <div className="px-6 py-5">
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary mb-7">Log in</h1>
          <form onSubmit={form.onSubmit(handleSubmit)} className="flex flex-col gap-4">
            <TextInput label="Email" placeholder="you@example.com" required {...form.getInputProps('email')} />
            <TextInput
              label="Password"
              type="password"
              placeholder="Your password"
              required
              {...form.getInputProps('password')}
            />
            {submitError && (
              <p className="text-sm text-form-error" role="alert">
                {submitError}
              </p>
            )}
            <Button type="submit" variant="filled" color="accent" size="md" loading={isSubmitting} className="mt-6">
              Log in
            </Button>
          </form>
          <p className="text-base text-text-secondary mt-6">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-accent font-medium">
              Register
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
