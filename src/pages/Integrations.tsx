// src/pages/Integrations.tsx
import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useIntegrations } from '@/hooks/useIntegrations';
import { integrationService } from '@/services/integrationService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw, Plug, Workflow, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Integration } from '@/types/integration.types';

export const Integrations = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { useIntegrationsList, useConnectionsList, useWorkflowsList, initiateOAuth } = useIntegrations();
  const [activeTab, setActiveTab] = useState<'available' | 'connected' | 'workflows'>('available');
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);
  const debugOAuth = import.meta.env.DEV || import.meta.env.VITE_DEBUG_OAUTH === 'true';

  const logOAuth = (...args: unknown[]) => {
    if (debugOAuth) {
      // eslint-disable-next-line no-console
      console.debug('[Integrations][OAuth]', ...args);
    }
  };

  // Fetch data
  const { data: integrationsData, error: integrationsError, isLoading: integrationsLoading, mutate: mutateIntegrations } = useIntegrationsList({ is_active: true });
  const { data: connectionsData, error: connectionsError, isLoading: connectionsLoading, mutate: mutateConnections } = useConnectionsList({ is_active: true });
  const { data: workflowsData, error: workflowsError, isLoading: workflowsLoading, mutate: mutateWorkflows } = useWorkflowsList();

  // In your useEffect for OAuth callback, add a check
useEffect(() => {
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // WAIT for integrations data to load before processing
  if (code && state && !isProcessingOAuth && integrationsData?.results) {
    logOAuth('Detected OAuth params in URL', { codePreview: `${code.slice(0, 6)}...`, state });
    setIsProcessingOAuth(true);

    const handleOAuthCallback = async () => {
      try {
        toast.info('Processing Google authorization...');

        const googleIntegration = integrationsData.results.find(
          (integration) => integration.type === 'GOOGLE_SHEETS'
        );

        if (!googleIntegration) {
          logOAuth('Google integration not found in list', integrationsData.results);
          throw new Error('Google Sheets integration not found');
        }

        // Construct the same redirect_uri used during OAuth initiation
        let redirectUri = `${window.location.origin}${window.location.pathname}`;
        if (!redirectUri.endsWith('/')) {
          redirectUri += '/';
        }

        logOAuth('Posting OAuth callback to backend', {
          integrationId: googleIntegration.id,
          state,
          redirectUri,
        });

        const data = await integrationService.oauthCallback({
          code,
          state,
          integration_id: googleIntegration.id,
          connection_name: 'Google Sheets',
          redirect_uri: redirectUri,
        });

        logOAuth('OAuth callback response', data);
        toast.success(`Successfully connected!`);
        mutateConnections();
        setActiveTab('connected');
        
        searchParams.delete('code');
        searchParams.delete('state');
        searchParams.delete('scope');
        setSearchParams(searchParams, { replace: true });

      } catch (error: any) {
        console.error('OAuth callback error:', error);
        logOAuth('OAuth callback failed', {
          message: error?.message,
          response: error?.response?.data,
          stack: error?.stack,
        });
        toast.error(`Connection failed: ${error.message}`);

        searchParams.delete('code');
        searchParams.delete('state');
        searchParams.delete('scope');
        setSearchParams(searchParams, { replace: true });
      } finally {
        setIsProcessingOAuth(false);
      }
    };

    handleOAuthCallback();
  }
}, [searchParams, setSearchParams, mutateConnections, isProcessingOAuth, integrationsData]); // ADD integrationsData to dependencies

  // Handle OAuth callback success/error from backend redirect (legacy support)
  useEffect(() => {
    const success = searchParams.get('oauth_success');
    const connectionName = searchParams.get('connection_name');

    if (success === 'true') {
      toast.success(`Successfully connected ${connectionName || 'Google Sheets'}!`, {
        description: 'You can now create workflows using this connection',
        duration: 5000,
      });

      // Refresh connections list
      mutateConnections();

      // Switch to connected tab
      setActiveTab('connected');

      // Clean up URL
      searchParams.delete('oauth_success');
      searchParams.delete('connection_name');
      setSearchParams(searchParams, { replace: true });
    }

    const error = searchParams.get('oauth_error');
    if (error) {
      logOAuth('Received oauth_error from backend redirect', error);
      toast.error(`Connection failed: ${error}`, {
        description: 'Please try again or contact support',
        duration: 7000,
      });

      // Clean up URL
      searchParams.delete('oauth_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, mutateConnections]);

  const handleRefresh = useCallback(() => {
    mutateIntegrations();
    mutateConnections();
    mutateWorkflows();
    toast.success('Refreshed successfully');
  }, [mutateIntegrations, mutateConnections, mutateWorkflows]);

  const handleConnectIntegration = useCallback(async (integration: Integration) => {
    try {
      // Check if integration is already connected
      const existingConnection = connectionsData?.results.find(conn => conn.integration === integration.id);

      if (existingConnection) {
        // Show info that integration is already connected
        const accountName = existingConnection.name || existingConnection.integration_details?.name || 'your account';
        toast.info(`Already connected to ${accountName}`, {
          description: 'You can manage this connection from the Connected tab',
          duration: 5000,
        });

        // Switch to connected tab to show the existing connection
        setActiveTab('connected');
        return;
      }

      if (integration.requires_oauth) {
        // Initiate OAuth flow
        toast.info('Redirecting to Google for authorization...');

        // Construct the redirect URI - where Google should send the user back
        // Ensure it ends with a trailing slash to match Google Cloud Console configuration
        let redirectUri = `${window.location.origin}${window.location.pathname}`;
        if (!redirectUri.endsWith('/')) {
          redirectUri += '/';
        }

        logOAuth('Initiating OAuth with redirect_uri', { redirectUri });

        const result = await initiateOAuth({
          integration_id: integration.id,
          redirect_uri: redirectUri
        });

        // Validate that we received a valid authorization URL
        if (!result?.authorization_url) {
          throw new Error('No authorization URL received from server');
        }

        // Ensure the authorization URL points to Google OAuth
        if (!result.authorization_url.includes('accounts.google.com')) {
          console.error('Invalid authorization URL:', result.authorization_url);
          throw new Error('Invalid authorization URL received');
        }

        // Log the authorization URL for debugging (helps verify redirect_uri parameter)
        logOAuth('Authorization URL received', {
          url: result.authorization_url,
          state: result.state,
          integrationId: integration.id,
          parsedRedirect: (() => {
            try {
              const parsed = new URL(result.authorization_url);
              return parsed.searchParams.get('redirect_uri');
            } catch {
              return 'unparseable';
            }
          })(),
        });

        // Redirect to Google OAuth
        window.location.href = result.authorization_url;
      } else {
        // For non-OAuth integrations, navigate to manual setup
        navigate(`/integrations/connect/${integration.id}`);
      }
    } catch (error: any) {
      console.error('OAuth initiation error:', error);
      toast.error(error.message || 'Failed to initiate connection');
    }
  }, [navigate, initiateOAuth, connectionsData, setActiveTab]);

  const handleViewWorkflows = useCallback(() => {
    navigate('/integrations/workflows');
  }, [navigate]);

  const handleCreateWorkflow = useCallback(() => {
    navigate('/integrations/workflows/new');
  }, [navigate]);

  // Check if an integration is connected
  const isConnected = useCallback((integrationId: number) => {
    return connectionsData?.results.some(conn => conn.integration === integrationId) || false;
  }, [connectionsData]);

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Integrations</h1>
          <span className="text-xs text-muted-foreground">
            {connectionsData?.count || 0} connected
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={handleCreateWorkflow} size="sm" className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="h-8">
          <TabsTrigger value="available" className="text-xs h-6 px-2.5">Available</TabsTrigger>
          <TabsTrigger value="connected" className="text-xs h-6 px-2.5">Connected</TabsTrigger>
          <TabsTrigger value="workflows" className="text-xs h-6 px-2.5">Workflows</TabsTrigger>
        </TabsList>

        {/* Available Integrations Tab */}
        <TabsContent value="available" className="mt-3">
          {integrationsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <Skeleton className="h-8 w-8 rounded mb-3" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-full mb-3" />
                  <Skeleton className="h-7 w-full" />
                </div>
              ))}
            </div>
          ) : integrationsError ? (
            <div className="text-center py-8">
              <p className="text-xs text-red-500">Failed to load integrations</p>
              <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={handleRefresh}>
                Try Again
              </Button>
            </div>
          ) : !integrationsData?.results?.length ? (
            <div className="text-center py-8">
              <Plug className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No integrations available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {integrationsData.results.map((integration) => (
                <div key={integration.id} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-1.5 bg-gray-100 rounded">
                      {integration.logo_url ? (
                        <img src={integration.logo_url} alt={integration.name} className="h-5 w-5" />
                      ) : (
                        <Plug className="h-5 w-5 text-gray-600" />
                      )}
                    </div>
                    {isConnected(integration.id) && (
                      <Badge className="text-[10px] bg-green-100 text-green-800 border-green-200">
                        Connected
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-sm font-medium mb-1">{integration.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {integration.description}
                  </p>
                  <Button
                    variant={isConnected(integration.id) ? 'outline' : 'default'}
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => handleConnectIntegration(integration)}
                  >
                    {isConnected(integration.id) ? 'Manage' : integration.requires_oauth ? 'Connect' : 'Add'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Connected Apps Tab */}
        <TabsContent value="connected" className="mt-3">
          {connectionsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <div>
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-16" />
                </div>
              ))}
            </div>
          ) : !connectionsData?.results?.length ? (
            <div className="text-center py-8">
              <Check className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No connected apps</p>
              <Button onClick={() => setActiveTab('available')} size="sm" className="mt-2 h-7 text-xs">
                Browse Integrations
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {connectionsData.results.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-100 rounded">
                      {connection.integration_details?.logo_url ? (
                        <img src={connection.integration_details.logo_url} alt={connection.name} className="h-4 w-4" />
                      ) : (
                        <Plug className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{connection.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {connection.integration_details?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={connection.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {connection.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => navigate(`/integrations/connections/${connection.id}`)}
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="mt-3">
          {workflowsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-full mb-2" />
                  <div className="flex gap-1">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : !workflowsData?.results?.length ? (
            <div className="text-center py-8">
              <Workflow className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No workflows yet</p>
              <Button onClick={handleCreateWorkflow} size="sm" className="mt-2 h-7 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Workflow
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {workflowsData.results.map((workflow) => (
                <div
                  key={workflow.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/integrations/workflows/${workflow.id}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium">{workflow.name}</h3>
                    <Badge variant={workflow.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {workflow.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {workflow.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{workflow.description}</p>
                  )}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/integrations/workflows/${workflow.id}`);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/integrations/workflows/${workflow.id}/logs`);
                      }}
                    >
                      Logs
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Integrations;
