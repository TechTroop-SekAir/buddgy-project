import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { logout } = useAuth();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Envelope Dashboard</h1>
        <Button variant="outline" color="gray" size="md" onClick={logout}>
          Log out
        </Button>
      </div>
      <p className="text-text-secondary">Placeholder for A-05.</p>
      <Button mt="md">Add Envelope</Button>
    </div>
  );
}
