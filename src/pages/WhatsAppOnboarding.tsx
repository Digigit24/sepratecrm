// src/pages/WhatsAppOnboarding.tsx
import { useState, useEffect } from 'react';
import { FacebookLoginButton } from '@/components/FacebookLoginButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { CheckCircle2, Building2, Phone, Key, Hash, User, Loader2 } from 'lucide-react';
import {
  onboardWhatsAppClient,
  createTenantConfig,
  updateTenantConfig,
  getTenantConfig,
} from '@/services/tenantConfigService';
import { WhatsAppOnboardingRequest } from '@/types/tenantConfig';

interface ClientData {
  id: string;
  client_name: string;
  waba_id: string;
  phone_number_id: string;
  access_token: string;
}

export default function WhatsAppOnboarding() {
  // Multi-tenancy: Client selector
  const [selectedClientId, setSelectedClientId] = useState<string>('client-a');

  // OAuth and Embedded Signup state
  const [oauthCode, setOauthCode] = useState<string>('');
  const [embeddedSignupData, setEmbeddedSignupData] = useState<{
    waba_id: string;
    phone_number_id: string;
  } | null>(null);
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Tenant Configuration state
  const [tenantConfig, setTenantConfig] = useState<any>(null);
  const [isFetchingConfig, setIsFetchingConfig] = useState(false);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  // Mock clients for demonstration
  const [clients, setClients] = useState<ClientData[]>([
    {
      id: 'client-a',
      client_name: 'Test Client A',
      waba_id: '',
      phone_number_id: '',
      access_token: '',
    },
    {
      id: 'client-b',
      client_name: 'Test Client B',
      waba_id: '',
      phone_number_id: '',
      access_token: '',
    },
  ]);

  // Get current client data
  const currentClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  // Update current client data
  const updateClientData = (field: keyof ClientData, value: string) => {
    setClients((prev) =>
      prev.map((client) =>
        client.id === selectedClientId
          ? { ...client, [field]: value }
          : client
      )
    );
  };

  // Fetch configuration on component mount
  useEffect(() => {
    handleFetchConfiguration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add postMessage listener for WhatsApp Embedded Signup completion
  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      try {
        // Parse the message data
        let data = event.data;

        // If data is a string, try to parse it as JSON
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) {
            // Not JSON, ignore
            return;
          }
        }

        // Check if this is a WhatsApp Embedded Signup completion event
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          console.log('WhatsApp Embedded Signup completed:', data);

          // Extract WABA ID and Phone Number ID from the event
          const wabaId = data.data?.waba_id || data.data?.id;
          const phoneNumberId = data.data?.phone_number_id;

          if (wabaId && phoneNumberId) {
            console.log('Captured from postMessage:', { wabaId, phoneNumberId });

            setEmbeddedSignupData({
              waba_id: wabaId,
              phone_number_id: phoneNumberId,
            });

            // Auto-fill the form fields
            updateClientData('waba_id', wabaId);
            updateClientData('phone_number_id', phoneNumberId);

            toast.success('WhatsApp Business Account details received!', {
              description: `WABA ID: ${wabaId.substring(0, 10)}...`,
            });
          } else {
            console.warn('WABA ID or Phone Number ID not found in postMessage data:', data);
          }
        }
      } catch (error) {
        console.error('Error processing postMessage:', error);
      }
    };

    // Add event listener
    window.addEventListener('message', handlePostMessage);

    // Cleanup
    return () => {
      window.removeEventListener('message', handlePostMessage);
    };
  }, []);

  // Trigger onboarding when both OAuth code and embedded signup data are available
  useEffect(() => {
    if (oauthCode && embeddedSignupData && !isOnboarding) {
      handleOnboardingFlow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthCode, embeddedSignupData]);

  // Handle the complete onboarding flow
  const handleOnboardingFlow = async () => {
    if (!oauthCode || !embeddedSignupData) {
      return;
    }

    setIsOnboarding(true);

    try {
      const request: WhatsAppOnboardingRequest = {
        code: oauthCode,
        waba_id: embeddedSignupData.waba_id,
        phone_number_id: embeddedSignupData.phone_number_id,
        redirect_uri: window.location.href,
      };

      console.log('Starting WhatsApp onboarding with:', request);

      const response = await onboardWhatsAppClient(request);

      toast.success('WhatsApp Business API onboarding completed!', {
        description: `Configuration saved for tenant: ${response.tenant_id}`,
        duration: 5000,
      });

      // Update the client data with the successful onboarding
      updateClientData('waba_id', response.waba_id);
      updateClientData('phone_number_id', response.phone_number_id);
      updateClientData('access_token', 'ONBOARDED');

      // Clear the temporary state
      setOauthCode('');
      setEmbeddedSignupData(null);
    } catch (error: any) {
      console.error('Onboarding failed:', error);

      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';

      toast.error('WhatsApp onboarding failed', {
        description: errorMessage,
        duration: 7000,
      });
    } finally {
      setIsOnboarding(false);
    }
  };

  const handleFacebookSuccess = (response: any) => {
    console.log('Facebook Embedded Signup successful:', response);

    // Extract data from Facebook response
    const { authResponse } = response;

    if (authResponse) {
      toast.success('Connected to Facebook successfully!');

      // Check if we received an authorization code (Authorization Code Flow)
      if (authResponse.code) {
        console.log('Authorization Code received:', authResponse.code);

        // Store the OAuth code - onboarding will trigger automatically
        // when both code and embedded signup data are available
        setOauthCode(authResponse.code);

        toast.info('Authorization code received. Waiting for WhatsApp account details...', {
          description: 'The embedded signup flow will provide WABA ID and Phone Number ID.',
        });
      }
      // If we got an access token directly (shouldn't happen with response_type: 'code')
      else if (authResponse.accessToken) {
        console.log('Access Token received:', authResponse.accessToken);
        updateClientData('access_token', authResponse.accessToken);
        toast.success('Access token received!');
      }

      // Log the full response for debugging
      console.log('Full authResponse:', authResponse);
    }
  };

  const handleFacebookError = (error: any) => {
    console.error('Facebook login error:', error);
    toast.error('Failed to connect to Facebook. Please try again.');
  };

  const handleSaveConfiguration = async () => {
    // Validate all fields
    if (!currentClient.client_name.trim()) {
      toast.error('Please enter a client name');
      return;
    }

    if (!currentClient.waba_id.trim()) {
      toast.error('Please enter WABA ID');
      return;
    }

    if (!currentClient.phone_number_id.trim()) {
      toast.error('Please enter Phone Number ID');
      return;
    }

    if (!currentClient.access_token.trim()) {
      toast.error('Please enter or obtain an access token');
      return;
    }

    setIsUpdatingConfig(true);

    try {
      // Try to update first, if it fails, create new
      try {
        await updateTenantConfig({
          waba_id: currentClient.waba_id,
          phone_number_id: currentClient.phone_number_id,
          access_token: currentClient.access_token,
        });

        toast.success(`Configuration updated for ${currentClient.client_name}!`);
      } catch (updateError: any) {
        // If update fails (404 - not found), try to create
        if (updateError.response?.status === 404) {
          await createTenantConfig({
            waba_id: currentClient.waba_id,
            phone_number_id: currentClient.phone_number_id,
          });

          toast.success(`Configuration created for ${currentClient.client_name}!`);
        } else {
          throw updateError;
        }
      }

      // Refresh the configuration after save
      await handleFetchConfiguration();
    } catch (error: any) {
      console.error('Failed to save configuration:', error);

      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';

      toast.error('Failed to save configuration', {
        description: errorMessage,
      });
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  // Fetch current tenant configuration
  const handleFetchConfiguration = async () => {
    setIsFetchingConfig(true);

    try {
      const config = await getTenantConfig();
      setTenantConfig(config);

      toast.success('Configuration loaded successfully!');

      // Auto-fill form with fetched data
      if (config.waba_id) {
        updateClientData('waba_id', config.waba_id);
      }
      if (config.phone_number_id) {
        updateClientData('phone_number_id', config.phone_number_id);
      }
    } catch (error: any) {
      console.error('Failed to fetch configuration:', error);

      if (error.response?.status === 404) {
        toast.info('No configuration found for this tenant', {
          description: 'You can create a new configuration by filling the form below.',
        });
        setTenantConfig(null);
      } else {
        const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';

        toast.error('Failed to fetch configuration', {
          description: errorMessage,
        });
      }
    } finally {
      setIsFetchingConfig(false);
    }
  };

  // Deactivate configuration
  const handleDeactivateConfiguration = async () => {
    if (!tenantConfig) {
      toast.error('No configuration to deactivate');
      return;
    }

    setIsUpdatingConfig(true);

    try {
      await updateTenantConfig({ is_active: false });

      toast.success('Configuration deactivated successfully!');

      // Refresh configuration
      await handleFetchConfiguration();
    } catch (error: any) {
      console.error('Failed to deactivate configuration:', error);

      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';

      toast.error('Failed to deactivate configuration', {
        description: errorMessage,
      });
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  // Activate configuration
  const handleActivateConfiguration = async () => {
    if (!tenantConfig) {
      toast.error('No configuration to activate');
      return;
    }

    setIsUpdatingConfig(true);

    try {
      await updateTenantConfig({ is_active: true });

      toast.success('Configuration activated successfully!');

      // Refresh configuration
      await handleFetchConfiguration();
    } catch (error: any) {
      console.error('Failed to activate configuration:', error);

      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';

      toast.error('Failed to activate configuration', {
        description: errorMessage,
      });
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const isConfigurationComplete = () => {
    return (
      currentClient.client_name.trim() !== '' &&
      currentClient.waba_id.trim() !== '' &&
      currentClient.phone_number_id.trim() !== '' &&
      currentClient.access_token.trim() !== ''
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="px-4 py-4 md:px-6 md:py-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">WhatsApp Business Onboarding</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your WhatsApp Business Account and configure client credentials
              </p>
            </div>
          </div>

          {/* Multi-Tenancy Client Selector */}
          <div className="mt-4 flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Label htmlFor="client-selector" className="text-sm font-medium mb-1 block">
                Select Client (Multi-Tenancy Demo)
              </Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client-selector" className="w-full md:w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.client_name}
                      {isConfigurationComplete() && client.id === selectedClientId && (
                        <CheckCircle2 className="inline-block ml-2 h-4 w-4 text-green-500" />
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Switch between different clients to configure multiple WhatsApp Business accounts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Step 1: Facebook Embedded Signup */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  1
                </div>
                <div>
                  <CardTitle>Connect with Facebook</CardTitle>
                  <CardDescription>
                    Use Facebook Embedded Signup to authorize WhatsApp Business API
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-100 mb-3">
                  <strong>What happens when you click "Login with Facebook":</strong>
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                  <li>Facebook Embedded Signup flow will open</li>
                  <li>You'll authorize your WhatsApp Business Account (WABA)</li>
                  <li>Facebook will return your WABA ID and Phone Number ID</li>
                  <li>You'll receive an authorization code to exchange for an access token</li>
                </ul>
              </div>

              <div className="flex justify-center py-4">
                <div className={isOnboarding ? 'pointer-events-none opacity-50' : ''}>
                  <FacebookLoginButton
                    appId={import.meta.env.VITE_FACEBOOK_APP_ID || ''}
                    configId={import.meta.env.VITE_FACEBOOK_CONFIG_ID}
                    onSuccess={handleFacebookSuccess}
                    onError={handleFacebookError}
                    buttonText={isOnboarding ? 'Onboarding...' : 'Login with Facebook'}
                    size="lg"
                  />
                </div>
              </div>

              {/* Onboarding Status Indicator */}
              {(oauthCode || embeddedSignupData || isOnboarding) && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {isOnboarding ? 'Completing onboarding...' : 'Onboarding in progress'}
                    </p>
                    <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
                      <div className="flex items-center gap-2">
                        {oauthCode ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-blue-300" />
                        )}
                        <span>Authorization code received</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {embeddedSignupData ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-blue-300" />
                        )}
                        <span>WhatsApp Business Account details received</span>
                      </div>
                      {isOnboarding && (
                        <div className="flex items-center gap-2 mt-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          <span className="font-medium">Sending data to backend...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                After successful login, the access token will be auto-filled below
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          {/* Step 2: Manual Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  2
                </div>
                <div>
                  <CardTitle>Manual Configuration</CardTitle>
                  <CardDescription>
                    Enter your WhatsApp Business API credentials manually
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Client Name */}
              <div className="space-y-2">
                <Label htmlFor="client_name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Client Name *
                </Label>
                <Input
                  id="client_name"
                  placeholder="e.g., Test Client A"
                  value={currentClient.client_name}
                  onChange={(e) => updateClientData('client_name', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  A friendly name to identify this client in your system
                </p>
              </div>

              <Separator />

              {/* WABA ID */}
              <div className="space-y-2">
                <Label htmlFor="waba_id" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  WhatsApp Business Account ID (WABA ID) *
                </Label>
                <Input
                  id="waba_id"
                  placeholder="e.g., 123456789012345"
                  value={currentClient.waba_id}
                  onChange={(e) => updateClientData('waba_id', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Returned by Embedded Signup or found in your Facebook Business Manager
                </p>
              </div>

              {/* Phone Number ID */}
              <div className="space-y-2">
                <Label htmlFor="phone_number_id" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number ID *
                </Label>
                <Input
                  id="phone_number_id"
                  placeholder="e.g., 987654321098765"
                  value={currentClient.phone_number_id}
                  onChange={(e) => updateClientData('phone_number_id', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Returned by Embedded Signup or found in your WhatsApp Business API settings
                </p>
              </div>

              {/* Access Token */}
              <div className="space-y-2">
                <Label htmlFor="access_token" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Access Token *
                </Label>
                <Input
                  id="access_token"
                  type="password"
                  placeholder="Exchanged from authorization code or System User Token"
                  value={currentClient.access_token}
                  onChange={(e) => updateClientData('access_token', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  System User Token from Facebook Business Manager or exchanged from OAuth code
                </p>
              </div>

            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                onClick={handleSaveConfiguration}
                size="lg"
                className="w-full"
                disabled={!isConfigurationComplete() || isUpdatingConfig}
              >
                {isUpdatingConfig ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : isConfigurationComplete() ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Configuration for {currentClient.client_name}
                  </>
                ) : (
                  'Complete all fields to save'
                )}
              </Button>

              {isConfigurationComplete() && (
                <div className="w-full p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        Configuration Complete!
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        All required fields are filled for <strong>{currentClient.client_name}</strong>.
                        Click "Save Configuration" to store these settings.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardFooter>
          </Card>

          {/* Tenant Configuration Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Backend Configuration Status</CardTitle>
                  <CardDescription>
                    Manage your tenant's WhatsApp Business API configuration
                  </CardDescription>
                </div>
                <Button
                  onClick={handleFetchConfiguration}
                  disabled={isFetchingConfig}
                  variant="outline"
                  size="sm"
                >
                  {isFetchingConfig ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Fetch Config'
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenantConfig ? (
                <>
                  {/* Configuration Status Badge */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        tenantConfig.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {tenantConfig.is_active ? 'Active' : 'Inactive'}
                    </div>
                    {tenantConfig.onboarding_completed && (
                      <div className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Onboarded
                      </div>
                    )}
                  </div>

                  {/* Configuration Details */}
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <span className="text-muted-foreground">Tenant ID:</span>
                      <span className="font-mono">{tenantConfig.tenant_id}</span>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <span className="text-muted-foreground">WABA ID:</span>
                      <span className="font-mono">{tenantConfig.waba_id || '—'}</span>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <span className="text-muted-foreground">Phone Number ID:</span>
                      <span className="font-mono">{tenantConfig.phone_number_id || '—'}</span>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <span className="text-muted-foreground">Access Token:</span>
                      <span className="font-mono text-xs">
                        {tenantConfig.access_token ? `${tenantConfig.access_token}` : '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <span className="text-muted-foreground">Onboarded At:</span>
                      <span className="font-mono text-xs">
                        {tenantConfig.onboarded_at
                          ? new Date(tenantConfig.onboarded_at).toLocaleString()
                          : '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <span className="text-muted-foreground">Last Updated:</span>
                      <span className="font-mono text-xs">
                        {new Date(tenantConfig.updated_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {tenantConfig.is_active ? (
                      <Button
                        onClick={handleDeactivateConfiguration}
                        disabled={isUpdatingConfig}
                        variant="destructive"
                        size="sm"
                      >
                        {isUpdatingConfig ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Deactivating...
                          </>
                        ) : (
                          'Deactivate Configuration'
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleActivateConfiguration}
                        disabled={isUpdatingConfig}
                        variant="default"
                        size="sm"
                      >
                        {isUpdatingConfig ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Activating...
                          </>
                        ) : (
                          'Activate Configuration'
                        )}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-4">
                    No configuration found. Click "Fetch Config" to load your tenant configuration,
                    or create a new one using the form above.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
            <CardHeader>
              <CardTitle className="text-base">Multi-Tenancy Support</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                This interface demonstrates multi-tenancy by allowing you to configure
                multiple clients with separate WhatsApp Business accounts.
              </p>
              <p>
                <strong>To test multi-tenancy:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Configure credentials for "Test Client A" using the client selector above</li>
                <li>Switch to "Test Client B" using the client selector</li>
                <li>Configure different credentials for Client B</li>
                <li>Switch back and forth to see that each client maintains separate data</li>
              </ol>
            </CardContent>
          </Card>

          {/* Current Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Configuration Summary</CardTitle>
              <CardDescription>Review the configuration for {currentClient.client_name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-mono">{currentClient.client_name || '—'}</span>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                  <span className="text-muted-foreground">WABA ID:</span>
                  <span className="font-mono">{currentClient.waba_id || '—'}</span>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                  <span className="text-muted-foreground">Phone ID:</span>
                  <span className="font-mono">{currentClient.phone_number_id || '—'}</span>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                  <span className="text-muted-foreground">Access Token:</span>
                  <span className="font-mono">
                    {currentClient.access_token
                      ? `${currentClient.access_token.substring(0, 20)}...`
                      : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
