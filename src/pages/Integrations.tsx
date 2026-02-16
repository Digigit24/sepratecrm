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
    <div className="p-6 max-w-8xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Connect your favorite apps and automate your workflows
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreateWorkflow} size="default" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Plug className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Available Integrations</p>
                <p className="text-xl sm:text-2xl font-bold">{integrationsData?.count || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Connected Apps</p>
                <p className="text-xl sm:text-2xl font-bold">{connectionsData?.count || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Workflow className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Active Workflows</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {workflowsData?.results.filter(w => w.is_active).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="connected">Connected</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        {/* Available Integrations Tab */}
        <TabsContent value="available" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Integrations</CardTitle>
              <CardDescription>
                Connect to your favorite apps and start automating your workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              {integrationsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <Skeleton className="h-12 w-12 rounded-lg mb-4" />
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full mb-4" />
                        <Skeleton className="h-10 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : integrationsError ? (
                <div className="text-center py-12">
                  <p className="text-red-500">Failed to load integrations</p>
                  <Button variant="outline" className="mt-4" onClick={handleRefresh}>
                    Try Again
                  </Button>
                </div>
              ) : !integrationsData || !integrationsData.results || integrationsData.results.length === 0 ? (
                <div className="text-center py-12">
                  <Plug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No integrations available</p>
                  <p className="text-sm text-muted-foreground">Check back later for new integrations</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {integrationsData.results?.map((integration) => (
                    <Card key={integration.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-gray-100 rounded-lg">
                            {integration.logo_url ? (
                              <img src={integration.logo_url} alt={integration.name} className="h-8 w-8" />
                            ) : (
                              <Plug className="h-8 w-8 text-gray-600" />
                            )}
                          </div>
                          {isConnected(integration.id) && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              Connected
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{integration.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {integration.description}
                        </p>
                        <Button
                          variant={isConnected(integration.id) ? 'outline' : 'default'}
                          className="w-full"
                          onClick={() => handleConnectIntegration(integration)}
                        >
                          {isConnected(integration.id) ? (
                            <>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Manage
                            </>
                          ) : integration.requires_oauth ? (
                            <>
                              <Plug className="h-4 w-4 mr-2" />
                              Connect
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connected Apps Tab */}
        <TabsContent value="connected" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connected Apps</CardTitle>
              <CardDescription>
                Manage your connected integrations and their settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connectionsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div>
                          <Skeleton className="h-5 w-32 mb-2" />
                          <Skeleton className="h-4 w-48" />
                        </div>
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  ))}
                </div>
              ) : !connectionsData || !connectionsData.results || connectionsData.results.length === 0 ? (
                <div className="text-center py-12">
                  <Check className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No connected apps</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your first app to get started
                  </p>
                  <Button onClick={() => setActiveTab('available')}>
                    <Plug className="h-4 w-4 mr-2" />
                    Browse Integrations
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {connectionsData.results?.map((connection) => (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {connection.integration_details?.logo_url ? (
                            <img
                              src={connection.integration_details.logo_url}
                              alt={connection.name}
                              className="h-6 w-6"
                            />
                          ) : (
                            <Plug className="h-6 w-6 text-gray-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{connection.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {connection.integration_details?.name || 'Unknown Integration'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={connection.is_active ? 'default' : 'secondary'}>
                          {connection.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/integrations/connections/${connection.id}`)}
                        >
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Workflows</CardTitle>
                  <CardDescription>
                    Automate your processes with custom workflows
                  </CardDescription>
                </div>
                <Button onClick={handleCreateWorkflow}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Workflow
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {workflowsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-full mb-4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !workflowsData || !workflowsData.results || workflowsData.results.length === 0 ? (
                <div className="text-center py-12">
                  <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No workflows yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first workflow to automate your processes
                  </p>
                  <Button onClick={handleCreateWorkflow}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workflow
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {workflowsData.results?.map((workflow) => (
                    <div
                      key={workflow.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/integrations/workflows/${workflow.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{workflow.name}</h3>
                        <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                          {workflow.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground mb-3">{workflow.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/integrations/workflows/${workflow.id}`);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/integrations/workflows/${workflow.id}/logs`);
                          }}
                        >
                          View Logs
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Integrations;
