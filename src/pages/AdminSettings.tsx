// src/pages/AdminSettings.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Loader2, AlertCircle, Save, Building2, Database, Settings as SettingsIcon, Image as ImageIcon, X, User, Plus, Trash2, Moon, Sun, IndianRupee, MessageSquare } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { TenantUpdateData, TenantSettings } from '@/types/tenant.types';
import type { UserPreferences, WhatsAppDefaults } from '@/types/user.types';
import { authClient } from '@/lib/client';
import { API_CONFIG, buildUrl } from '@/lib/apiConfig';
import { CurrencySettingsTab } from '@/components/admin-settings/CurrencySettingsTab';
import { WhatsAppDefaultsTab } from '@/components/admin-settings/WhatsAppDefaultsTab';

export const AdminSettings: React.FC = () => {
  // Get tenant from current session
  const { getTenant, user } = useAuth();
  const tenant = getTenant();
  const tenantId = tenant?.id || null;
  const userId = user?.id || null;

  const {
    useTenantDetail,
    updateTenant,
    isLoading: isMutating
  } = useTenant();

  const { data: tenantData, error, isLoading, mutate } = useTenantDetail(tenantId);

  // User Preferences state
  const [userPreferencesData, setUserPreferencesData] = useState<any>(null);
  const [userPreferencesLoading, setUserPreferencesLoading] = useState<boolean>(false);
  const [userPreferencesError, setUserPreferencesError] = useState<string | null>(null);
  const [editedPreferences, setEditedPreferences] = useState<UserPreferences>({});
  const [isSavingPreferences, setIsSavingPreferences] = useState<boolean>(false);
  const [newPrefKey, setNewPrefKey] = useState<string>('');
  const [newPrefValue, setNewPrefValue] = useState<string>('');
  const [whatsappDefaults, setWhatsappDefaults] = useState<WhatsAppDefaults>({});

  // Basic tenant fields (direct fields, not in settings)
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [trialEndsAt, setTrialEndsAt] = useState('');

  // Database configuration (direct fields)
  const [databaseName, setDatabaseName] = useState('');
  const [databaseUrl, setDatabaseUrl] = useState('');

  // Enabled modules (direct field)
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [newModule, setNewModule] = useState('');

  // Settings fields (all go into settings JSON)
  const [domain, setDomain] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // WhatsApp API settings
  const [whatsappVendorUid, setWhatsappVendorUid] = useState('');
  const [whatsappApiToken, setWhatsappApiToken] = useState('');

  // Branding settings (all go into settings JSON)
  const [headerBgColor, setHeaderBgColor] = useState('#3b82f6');
  const [headerTextColor, setHeaderTextColor] = useState('#ffffff');
  const [footerBgColor, setFooterBgColor] = useState('#3b82f6');
  const [footerTextColor, setFooterTextColor] = useState('#ffffff');
  const [headerUseGradient, setHeaderUseGradient] = useState(false);
  const [footerUseGradient, setFooterUseGradient] = useState(false);

  // Currency settings (all go into settings JSON)
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [currencyName, setCurrencyName] = useState('Indian Rupee');
  const [currencyDecimals, setCurrencyDecimals] = useState(2);
  const [currencyThousandSeparator, setCurrencyThousandSeparator] = useState(',');
  const [currencyDecimalSeparator, setCurrencyDecimalSeparator] = useState('.');
  const [currencySymbolPosition, setCurrencySymbolPosition] = useState<'before' | 'after'>('before');
  const [currencyUseIndianNumbering, setCurrencyUseIndianNumbering] = useState(true);

  // Initialize form with tenant data
  useEffect(() => {
    if (tenantData) {
      // Direct fields
      setName(tenantData.name || '');
      setSlug(tenantData.slug || '');
      setIsActive(tenantData.is_active ?? true);
      setTrialEndsAt(tenantData.trial_ends_at ? new Date(tenantData.trial_ends_at).toISOString().split('T')[0] : '');
      setDatabaseName(tenantData.database_name || '');
      setDatabaseUrl(tenantData.database_url || '');
      setEnabledModules(tenantData.enabled_modules || []);

      // Settings fields
      const settings = tenantData.settings || {};
      setDomain(settings.domain || tenantData.domain || '');
      setAddress(settings.address || '');
      setContactEmail(settings.contact_email || '');
      setContactPhone(settings.contact_phone || '');
      setWebsiteUrl(settings.website_url || '');
      const headerBg = settings.header_bg_color || '#3b82f6';
      const footerBg = settings.footer_bg_color || '#3b82f6';

      setHeaderBgColor(headerBg);
      setHeaderTextColor(settings.header_text_color || '#ffffff');
      setFooterBgColor(footerBg);
      setFooterTextColor(settings.footer_text_color || '#ffffff');

      // Detect if it's a gradient (contains 'gradient')
      setHeaderUseGradient(headerBg.includes('gradient'));
      setFooterUseGradient(footerBg.includes('gradient'));

      // Load existing logo from settings
      if (settings.logo) {
        setLogoPreview(settings.logo);
      }

      // WhatsApp API settings
      setWhatsappVendorUid(settings.whatsapp_vendor_uid || '');
      setWhatsappApiToken(settings.whatsapp_api_token || '');

      // Currency settings
      setCurrencyCode(settings.currency_code || 'INR');
      setCurrencySymbol(settings.currency_symbol || '₹');
      setCurrencyName(settings.currency_name || 'Indian Rupee');
      setCurrencyDecimals(settings.currency_decimals || 2);
      setCurrencyThousandSeparator(settings.currency_thousand_separator || ',');
      setCurrencyDecimalSeparator(settings.currency_decimal_separator || '.');
      setCurrencySymbolPosition(settings.currency_symbol_position || 'before');
      setCurrencyUseIndianNumbering(settings.currency_use_indian_numbering ?? true);
    }
  }, [tenantData]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddModule = () => {
    if (newModule.trim() && !enabledModules.includes(newModule.trim())) {
      setEnabledModules([...enabledModules, newModule.trim()]);
      setNewModule('');
    }
  };

  const handleRemoveModule = (module: string) => {
    setEnabledModules(enabledModules.filter(m => m !== module));
  };

  const handleSave = async () => {
    if (!tenantId) {
      toast.error('No tenant ID found');
      return;
    }

    try {
      // Build settings object with all form data
      const settings: TenantSettings = {
        domain,
        address,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        website_url: websiteUrl,
        header_bg_color: headerBgColor,
        header_text_color: headerTextColor,
        footer_bg_color: footerBgColor,
        footer_text_color: footerTextColor,
        logo: logoPreview, // Base64 or URL
        // WhatsApp API settings
        whatsapp_vendor_uid: whatsappVendorUid,
        whatsapp_api_token: whatsappApiToken,
        // Currency settings
        currency_code: currencyCode,
        currency_symbol: currencySymbol,
        currency_name: currencyName,
        currency_decimals: currencyDecimals,
        currency_thousand_separator: currencyThousandSeparator,
        currency_decimal_separator: currencyDecimalSeparator,
        currency_symbol_position: currencySymbolPosition,
        currency_use_indian_numbering: currencyUseIndianNumbering,
      };

      const updateData: TenantUpdateData = {
        name,
        slug,
        database_name: databaseName || null,
        database_url: databaseUrl || null,
        enabled_modules: enabledModules,
        settings, // All form data goes here
        is_active: isActive,
        trial_ends_at: trialEndsAt || null,
      };

      await updateTenant(tenantId, updateData);
      toast.success('Tenant settings saved successfully');
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save tenant settings');
    }
  };

  // Fetch user preferences data
  const fetchUserPreferences = async () => {
    if (!userId) {
      setUserPreferencesError('No user ID found');
      return;
    }

    setUserPreferencesLoading(true);
    setUserPreferencesError(null);

    try {
      const url = buildUrl(API_CONFIG.AUTH.USERS.DETAIL, { id: userId }, 'auth');
      const response = await authClient.get(url);
      setUserPreferencesData(response.data);
      // Initialize editedPreferences with current preferences or empty object
      setEditedPreferences(response.data?.preferences || {});
      // Initialize whatsappDefaults from preferences
      setWhatsappDefaults(response.data?.preferences?.whatsappDefaults || {});
      console.log('User preferences data:', response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch user preferences';
      setUserPreferencesError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUserPreferencesLoading(false);
    }
  };

  // Save user preferences
  const saveUserPreferences = async () => {
    if (!userId) {
      toast.error('No user ID found');
      return;
    }

    setIsSavingPreferences(true);

    try {
      const url = buildUrl(API_CONFIG.AUTH.USERS.UPDATE, { id: userId }, 'auth');
      const response = await authClient.patch(url, { preferences: editedPreferences });
      setUserPreferencesData(response.data);
      setEditedPreferences(response.data?.preferences || {});

      // Update local storage and apply preferences immediately
      const { authService } = await import('@/services/authService');
      authService.updateUserPreferences(response.data?.preferences || {});

      toast.success('Preferences saved successfully');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save preferences';
      toast.error(errorMessage);
    } finally {
      setIsSavingPreferences(false);
    }
  };

  // Add custom preference
  const addCustomPreference = () => {
    if (!newPrefKey.trim()) {
      toast.error('Please enter a preference key');
      return;
    }

    setEditedPreferences(prev => ({
      ...prev,
      [newPrefKey]: newPrefValue
    }));
    setNewPrefKey('');
    setNewPrefValue('');
    toast.success('Preference added');
  };

  // Remove custom preference
  const removeCustomPreference = (key: string) => {
    setEditedPreferences(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    toast.success('Preference removed');
  };

  // Save WhatsApp defaults
  const saveWhatsAppDefaults = async () => {
    if (!userId) {
      toast.error('No user ID found');
      return;
    }

    setIsSavingPreferences(true);

    try {
      const url = buildUrl(API_CONFIG.AUTH.USERS.UPDATE, { id: userId }, 'auth');
      const updatedPreferences = {
        ...editedPreferences,
        whatsappDefaults,
      };
      const response = await authClient.patch(url, { preferences: updatedPreferences });
      setUserPreferencesData(response.data);
      setEditedPreferences(response.data?.preferences || {});
      setWhatsappDefaults(response.data?.preferences?.whatsappDefaults || {});

      // Update local storage and apply preferences immediately
      const { authService } = await import('@/services/authService');
      authService.updateUserPreferences(response.data?.preferences || {});

      toast.success('WhatsApp defaults saved successfully');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to save WhatsApp defaults';
      toast.error(errorMessage);
    } finally {
      setIsSavingPreferences(false);
    }
  };

  // Update preference value
  const updatePreferenceValue = (key: string, value: any) => {
    setEditedPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Show error if no tenant ID is found
  if (!tenantId) {
    return (
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Admin Settings</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Tenant Configuration & System Information
            </p>
          </div>
        </div>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-lg text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              No Tenant Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Unable to retrieve tenant information from your session. Please try logging in again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Tenant Configuration & System Information
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tenantData && (
            <Badge variant={tenantData.is_active ? 'default' : 'destructive'} className="w-fit">
              {tenantData.is_active ? 'Active' : 'Inactive'}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-lg text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Tenant Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{error.message || 'Failed to load tenant data'}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Tenant ID: {tenantId}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !tenantData && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">Loading tenant data...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenant Settings Forms */}
      {tenantData && (
        <Tabs defaultValue="tenant" className="w-full max-w-6xl">
          <TabsList className="grid w-full grid-cols-4 max-w-3xl">
            <TabsTrigger value="tenant">Tenant Settings</TabsTrigger>
            <TabsTrigger value="currency">
              <IndianRupee className="h-4 w-4 mr-2" />
              Currency
            </TabsTrigger>
            <TabsTrigger value="whatsapp" onClick={() => fetchUserPreferences()}>
              <MessageSquare className="h-4 w-4 mr-2" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="user" onClick={() => fetchUserPreferences()}>
              <User className="h-4 w-4 mr-2" />
              User Preferences
            </TabsTrigger>
          </TabsList>

          {/* Tenant Settings Tab */}
          <TabsContent value="tenant">
            <div className="space-y-6">
          {/* Basic Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <CardTitle>Tenant Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tenant Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter tenant name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder="tenant-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">Logo</Label>
                <div className="flex items-start gap-3">
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="cursor-pointer flex-1"
                  />
                  {logoPreview && (
                    <div className="w-12 h-12 border rounded overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  placeholder="Enter tenant address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="contact@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website</Label>
                  <Input
                    id="websiteUrl"
                    type="url"
                    placeholder="https://example.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                  />
                </div>
              </div>

              {/* WhatsApp API Configuration */}
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="whatsappVendorUid">WhatsApp Vendor UID</Label>
                <Input
                  id="whatsappVendorUid"
                  type="text"
                  placeholder="e.g., 90d99df2-4fc7-4957-a5ac-c5d95b771ee1"
                  value={whatsappVendorUid}
                  onChange={(e) => setWhatsappVendorUid(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your WhatsApp API Vendor UID from the WhatsApp service dashboard
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappApiToken">WhatsApp API Access Token</Label>
                <Input
                  id="whatsappApiToken"
                  type="password"
                  placeholder="Enter your WhatsApp API access token"
                  value={whatsappApiToken}
                  onChange={(e) => setWhatsappApiToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your WhatsApp API access token for authentication (stored securely)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="trialEndsAt">Trial Ends At</Label>
                  <Input
                    id="trialEndsAt"
                    type="date"
                    value={trialEndsAt}
                    onChange={(e) => setTrialEndsAt(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="isActive">Status</Label>
                  <div className="flex items-center gap-2 h-10">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <Label htmlFor="isActive" className="font-normal cursor-pointer">
                      Active
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branding & Colors Card */}
          <Card>
            <CardHeader>
              <CardTitle>Branding & Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Header Colors */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Header Colors</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Background Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="headerUseGradient"
                          checked={headerUseGradient}
                          onChange={(e) => {
                            setHeaderUseGradient(e.target.checked);
                            if (e.target.checked && !headerBgColor.includes('gradient')) {
                              setHeaderBgColor('linear-gradient(to right, #3b82f6, #8b5cf6)');
                            } else if (!e.target.checked && headerBgColor.includes('gradient')) {
                              setHeaderBgColor('#3b82f6');
                            }
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <Label htmlFor="headerUseGradient" className="text-xs font-normal cursor-pointer">
                          Use Gradient
                        </Label>
                      </div>
                    </div>
                    {headerUseGradient ? (
                      <Textarea
                        value={headerBgColor}
                        onChange={(e) => setHeaderBgColor(e.target.value)}
                        placeholder="linear-gradient(to right, #3b82f6, #8b5cf6)"
                        rows={2}
                        className="font-mono text-xs"
                      />
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={headerBgColor}
                          onChange={(e) => setHeaderBgColor(e.target.value)}
                          className="w-16 h-10 cursor-pointer p-1"
                        />
                        <Input
                          type="text"
                          value={headerBgColor}
                          onChange={(e) => setHeaderBgColor(e.target.value)}
                          placeholder="#3b82f6"
                          className="flex-1"
                        />
                      </div>
                    )}
                    {/* Preview */}
                    <div
                      className="h-10 rounded border"
                      style={{ background: headerBgColor }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Text Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={headerTextColor}
                        onChange={(e) => setHeaderTextColor(e.target.value)}
                        className="w-16 h-10 cursor-pointer p-1"
                      />
                      <Input
                        type="text"
                        value={headerTextColor}
                        onChange={(e) => setHeaderTextColor(e.target.value)}
                        placeholder="#ffffff"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Colors */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Footer Colors</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Background Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="footerUseGradient"
                          checked={footerUseGradient}
                          onChange={(e) => {
                            setFooterUseGradient(e.target.checked);
                            if (e.target.checked && !footerBgColor.includes('gradient')) {
                              setFooterBgColor('linear-gradient(to right, #3b82f6, #8b5cf6)');
                            } else if (!e.target.checked && footerBgColor.includes('gradient')) {
                              setFooterBgColor('#3b82f6');
                            }
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <Label htmlFor="footerUseGradient" className="text-xs font-normal cursor-pointer">
                          Use Gradient
                        </Label>
                      </div>
                    </div>
                    {footerUseGradient ? (
                      <Textarea
                        value={footerBgColor}
                        onChange={(e) => setFooterBgColor(e.target.value)}
                        placeholder="linear-gradient(to right, #3b82f6, #8b5cf6)"
                        rows={2}
                        className="font-mono text-xs"
                      />
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={footerBgColor}
                          onChange={(e) => setFooterBgColor(e.target.value)}
                          className="w-16 h-10 cursor-pointer p-1"
                        />
                        <Input
                          type="text"
                          value={footerBgColor}
                          onChange={(e) => setFooterBgColor(e.target.value)}
                          placeholder="#3b82f6"
                          className="flex-1"
                        />
                      </div>
                    )}
                    {/* Preview */}
                    <div
                      className="h-10 rounded border"
                      style={{ background: footerBgColor }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Text Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={footerTextColor}
                        onChange={(e) => setFooterTextColor(e.target.value)}
                        className="w-16 h-10 cursor-pointer p-1"
                      />
                      <Input
                        type="text"
                        value={footerTextColor}
                        onChange={(e) => setFooterTextColor(e.target.value)}
                        placeholder="#ffffff"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Configuration Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                <CardTitle className="text-lg">Database Configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="databaseName">Database Name</Label>
                <Input
                  id="databaseName"
                  placeholder="Neon database name"
                  value={databaseName}
                  onChange={(e) => setDatabaseName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="databaseUrl">Database URL</Label>
                <Textarea
                  id="databaseUrl"
                  placeholder="postgresql://..."
                  value={databaseUrl}
                  onChange={(e) => setDatabaseUrl(e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Enabled Modules Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                <CardTitle className="text-lg">Enabled Modules</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {enabledModules.map((module) => (
                  <Badge key={module} variant="secondary" className="px-3 py-1">
                    {module}
                    <button
                      onClick={() => handleRemoveModule(module)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {enabledModules.length === 0 && (
                  <p className="text-sm text-muted-foreground">No modules enabled</p>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add module (e.g., crm, whatsapp, hms)"
                  value={newModule}
                  onChange={(e) => setNewModule(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddModule()}
                />
                <Button onClick={handleAddModule} variant="outline">
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end sticky bottom-4 z-10">
            <Button
              onClick={handleSave}
              size="lg"
              className="shadow-lg"
              disabled={isMutating}
            >
              {isMutating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
            </div>
          </TabsContent>

          {/* Currency Settings Tab */}
          <TabsContent value="currency">
            <CurrencySettingsTab
              currencyCode={currencyCode}
              currencySymbol={currencySymbol}
              currencyName={currencyName}
              currencyDecimals={currencyDecimals}
              currencyThousandSeparator={currencyThousandSeparator}
              currencyDecimalSeparator={currencyDecimalSeparator}
              currencySymbolPosition={currencySymbolPosition}
              currencyUseIndianNumbering={currencyUseIndianNumbering}
              onCurrencyCodeChange={setCurrencyCode}
              onCurrencySymbolChange={setCurrencySymbol}
              onCurrencyNameChange={setCurrencyName}
              onCurrencyDecimalsChange={setCurrencyDecimals}
              onCurrencyThousandSeparatorChange={setCurrencyThousandSeparator}
              onCurrencyDecimalSeparatorChange={setCurrencyDecimalSeparator}
              onCurrencySymbolPositionChange={setCurrencySymbolPosition}
              onCurrencyUseIndianNumberingChange={setCurrencyUseIndianNumbering}
            />

            {/* Save Button */}
            <div className="flex justify-end mt-6">
              <Button
                onClick={handleSave}
                disabled={isMutating}
              >
                {isMutating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Currency Settings
              </Button>
            </div>
          </TabsContent>

          {/* WhatsApp Defaults Tab */}
          <TabsContent value="whatsapp">
            <WhatsAppDefaultsTab
              whatsappDefaults={whatsappDefaults}
              onWhatsAppDefaultsChange={setWhatsappDefaults}
              onSave={saveWhatsAppDefaults}
              isSaving={isSavingPreferences}
            />
          </TabsContent>

          {/* User Preferences Tab */}
          <TabsContent value="user">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      <CardTitle>User Preferences</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchUserPreferences}
                        disabled={userPreferencesLoading}
                      >
                        {userPreferencesLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Refresh
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveUserPreferences}
                        disabled={isSavingPreferences || userPreferencesLoading}
                      >
                        {isSavingPreferences ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Preferences
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {userPreferencesLoading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                        <p className="text-sm text-muted-foreground">Loading user data...</p>
                      </div>
                    </div>
                  )}

                  {userPreferencesError && (
                    <div className="text-destructive py-4">
                      <p className="text-sm font-semibold">Error:</p>
                      <p className="text-sm">{userPreferencesError}</p>
                    </div>
                  )}

                  {userPreferencesData && !userPreferencesLoading && (
                    <div className="space-y-6">
                      {/* Theme Preference */}
                      <div className="space-y-2">
                        <Label>Theme Preference</Label>
                        <div className="flex items-center gap-4">
                          <Button
                            type="button"
                            variant={editedPreferences.theme === 'light' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updatePreferenceValue('theme', 'light')}
                            className="flex items-center gap-2"
                          >
                            <Sun className="h-4 w-4" />
                            Light
                          </Button>
                          <Button
                            type="button"
                            variant={editedPreferences.theme === 'dark' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updatePreferenceValue('theme', 'dark')}
                            className="flex items-center gap-2"
                          >
                            <Moon className="h-4 w-4" />
                            Dark
                          </Button>
                          {editedPreferences.theme && (
                            <Badge variant="secondary">
                              Current: {editedPreferences.theme}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Custom Preferences */}
                      <div className="space-y-2">
                        <Label>Custom Preferences</Label>
                        <div className="space-y-3">
                          {Object.entries(editedPreferences)
                            .filter(([key]) => key !== 'theme')
                            .map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Key</Label>
                                    <p className="font-medium">{key}</p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Value</Label>
                                    <Input
                                      value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                      onChange={(e) => {
                                        try {
                                          const parsed = JSON.parse(e.target.value);
                                          updatePreferenceValue(key, parsed);
                                        } catch {
                                          updatePreferenceValue(key, e.target.value);
                                        }
                                      }}
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeCustomPreference(key)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Add New Preference */}
                      <div className="space-y-2 pt-4 border-t">
                        <Label>Add New Preference</Label>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label htmlFor="newPrefKey" className="text-xs">Key</Label>
                            <Input
                              id="newPrefKey"
                              placeholder="e.g., language, timezone"
                              value={newPrefKey}
                              onChange={(e) => setNewPrefKey(e.target.value)}
                            />
                          </div>
                          <div className="flex-1">
                            <Label htmlFor="newPrefValue" className="text-xs">Value</Label>
                            <Input
                              id="newPrefValue"
                              placeholder="Enter value"
                              value={newPrefValue}
                              onChange={(e) => setNewPrefValue(e.target.value)}
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={addCustomPreference}
                            size="sm"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!userPreferencesData && !userPreferencesLoading && !userPreferencesError && (
                    <div className="text-center py-12 text-muted-foreground">
                      <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Click the tab to load user preferences data</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* User Info Card (Read-only) */}
              {userPreferencesData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">User Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        <p className="font-medium">{userPreferencesData.email}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <p className="font-medium">{userPreferencesData.first_name} {userPreferencesData.last_name}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Timezone</Label>
                        <p className="font-medium">{userPreferencesData.timezone || 'Not set'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Badge variant={userPreferencesData.is_active ? 'default' : 'secondary'}>
                          {userPreferencesData.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
