import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export function LandingPage() {
  return (
    <div className="px-8 py-9">
      <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Buddgy</h1>
      <p className="text-base text-text-secondary mt-4 mb-7">
        Envelope budgeting with AI-parsed entries, CSV import, and calendar-synced forecasts.
      </p>
      <div className="flex gap-3">
        <Link to="/login">
          <Button variant="filled" color="accent" size="md">
            Log in
          </Button>
        </Link>
        <Link to="/register">
          <Button variant="outline" color="gray" size="md">
            Create account
          </Button>
        </Link>
      </div>
    </div>
  );
}
