// src/pages/OAuthCallback.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const success = searchParams.get('oauth_success');
    const error = searchParams.get('oauth_error');
    const connectionName = searchParams.get('connection_name');

    if (success === 'true') {
      toast.success(`Successfully connected ${connectionName || 'Google Sheets'}!`, {
        description: 'You can now create workflows',
      });
      navigate('/integrations?tab=connected');
    } else if (error) {
      toast.error(`Connection failed: ${error}`);
      navigate('/integrations');
    } else {
      // If no success/error params, just redirect
      toast.info('Processing connection...');
      navigate('/integrations');
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
        <h2 className="text-xl font-semibold mb-2">Completing authorization...</h2>
        <p className="text-muted-foreground">Please wait</p>
      </div>
    </div>
  );
};

export default OAuthCallback;