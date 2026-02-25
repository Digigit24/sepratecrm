// src/pages/AdminSettings.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, Loader2, AlertCircle, Save, Building2, Database, Settings as SettingsIcon, X, User, Plus, Trash2, Moon, Sun, IndianRupee, MessageSquare, Globe, Mail, Phone, Link, Palette, Calendar, Shield, Package } from 'lucide-react';
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

  // Basic tenant fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [trialEndsAt, setTrialEndsAt] = useState('');

  // Database configuration
  const [databaseName, setDatabaseName] = useState('');
  const [databaseUrl, setDatabaseUrl] = useState('');

  // Enabled modules
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [newModule, setNewModule] = useState('');

  // Settings fields
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

  // Branding settings
  const [headerBgColor, setHeaderBgColor] = useState('#3b82f6');
  const [headerTextColor, setHeaderTextColor] = useState('#ffffff');
  const [footerBgColor, setFooterBgColor] = useState('#3b82f6');
  const [footerTextColor, setFooterTextColor] = useState('#ffffff');
  const [headerUseGradient, setHeaderUseGradient] = useState(false);
  const [footerUseGradient, setFooterUseGradient] = useState(false);

  // Currency settings
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
      setName(tenantData.name || '');
      setSlug(tenantData.slug || '');
      setIsActive(tenantData.is_active ?? true);
      setTrialEndsAt(tenantData.trial_ends_at ? new Date(tenantData.trial_ends_at).toISOString().split('T')[0] : '');
      setDatabaseName(tenantData.database_name || '');
      setDatabaseUrl(tenantData.database_url || '');
      setEnabledModules(tenantData.enabled_modules || []);

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
      setHeaderUseGradient(headerBg.includes('gradient'));
      setFooterUseGradient(footerBg.includes('gradient'));

      if (settings.logo) {
        setLogoPreview(settings.logo);
      }

      setWhatsappVendorUid(settings.whatsapp_vendor_uid || '');
      setWhatsappApiToken(settings.whatsapp_api_token || '');

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
        logo: logoPreview,
        whatsapp_vendor_uid: whatsappVendorUid,
        whatsapp_api_token: whatsappApiToken,
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
        settings,
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
      setEditedPreferences(response.data?.preferences || {});
      setWhatsappDefaults(response.data?.preferences?.whatsappDefaults || {});
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

  const removeCustomPreference = (key: string) => {
    setEditedPreferences(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    toast.success('Preference removed');
  };

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

  const updatePreferenceValue = (key: string, value: any) => {
    setEditedPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // No tenant ID error
  if (!tenantId) {
    return (
      <div className="p-4 space-y-2">
        <h1 className="text-base font-semibold">Admin Settings</h1>
        <div className="border border-destructive/50 rounded-md p-3">
          <div className="flex items-center gap-1.5 text-destructive mb-0.5">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">No Tenant Found</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Unable to retrieve tenant information. Please try logging in again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-4 space-y-3">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-base font-semibold">Settings</h1>
            {tenantData && (
              <Badge
                variant={tenantData.is_active ? 'default' : 'destructive'}
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {tenantData.is_active ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => mutate()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Refresh</p></TooltipContent>
          </Tooltip>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 p-2.5 border border-destructive/50 rounded-md bg-destructive/5">
            <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-destructive">Error loading tenant data</p>
              <p className="text-[10px] text-muted-foreground">ID: {tenantId}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !tenantData && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground ml-2">Loading...</span>
          </div>
        )}

        {/* Settings Tabs */}
        {tenantData && (
          <Tabs defaultValue="tenant" className="w-full">
            <TabsList className="h-8 p-0.5 gap-0.5">
              <TabsTrigger value="tenant" className="text-xs h-6 px-2.5 gap-1">
                <Building2 className="h-3 w-3" />
                Tenant
              </TabsTrigger>
              <TabsTrigger value="branding" className="text-xs h-6 px-2.5 gap-1">
                <Palette className="h-3 w-3" />
                Branding
              </TabsTrigger>
              <TabsTrigger value="currency" className="text-xs h-6 px-2.5 gap-1">
                <IndianRupee className="h-3 w-3" />
                Currency
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs h-6 px-2.5 gap-1" onClick={() => fetchUserPreferences()}>
                <MessageSquare className="h-3 w-3" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="user" className="text-xs h-6 px-2.5 gap-1" onClick={() => fetchUserPreferences()}>
                <User className="h-3 w-3" />
                Preferences
              </TabsTrigger>
            </TabsList>

            {/* ── Tenant Settings Tab ── */}
            <TabsContent value="tenant" className="mt-3">
              <div className="space-y-3">
                {/* Tenant Info - compact grid */}
                <Card className="border-border/60">
                  <CardHeader className="p-3 pb-0">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tenant Information</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Name</Label>
                        <Input
                          placeholder="Tenant name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Slug</Label>
                        <Input
                          placeholder="tenant-slug"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Domain</Label>
                        <Input
                          placeholder="example.com"
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* Logo + Address row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Logo</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="h-8 text-xs cursor-pointer flex-1"
                          />
                          {logoPreview && (
                            <div className="w-8 h-8 border rounded overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                              <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Address</Label>
                        <Textarea
                          placeholder="Address"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          rows={1}
                          className="text-xs min-h-[32px] resize-none"
                        />
                      </div>
                    </div>

                    {/* Contact row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <Mail className="h-2.5 w-2.5" /> Email
                        </Label>
                        <Input
                          type="email"
                          placeholder="contact@example.com"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" /> Phone
                        </Label>
                        <Input
                          type="tel"
                          placeholder="+1 (555) 123-4567"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <Link className="h-2.5 w-2.5" /> Website
                        </Label>
                        <Input
                          type="url"
                          placeholder="https://example.com"
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* WhatsApp API + Status row */}
                    <div className="border-t border-border/40 mt-3 pt-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                        <MessageSquare className="h-2.5 w-2.5" /> WhatsApp API
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Vendor UID</Label>
                          <Input
                            placeholder="e.g., 90d99df2-4fc7-..."
                            value={whatsappVendorUid}
                            onChange={(e) => setWhatsappVendorUid(e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Access Token</Label>
                          <Input
                            type="password"
                            placeholder="API access token"
                            value={whatsappApiToken}
                            onChange={(e) => setWhatsappApiToken(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Trial & Status row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" /> Trial Ends At
                        </Label>
                        <Input
                          type="date"
                          value={trialEndsAt}
                          onChange={(e) => setTrialEndsAt(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <Shield className="h-2.5 w-2.5" /> Status
                        </Label>
                        <div className="flex items-center gap-2 h-8">
                          <input
                            type="checkbox"
                            id="isActive"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="w-3.5 h-3.5 rounded"
                          />
                          <Label htmlFor="isActive" className="text-xs font-normal cursor-pointer">
                            Active
                          </Label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Database + Modules side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Database */}
                  <Card className="border-border/60">
                    <CardHeader className="p-3 pb-0">
                      <div className="flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Database</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-2 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Name</Label>
                        <Input
                          placeholder="Neon database name"
                          value={databaseName}
                          onChange={(e) => setDatabaseName(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">URL</Label>
                        <Textarea
                          placeholder="postgresql://..."
                          value={databaseUrl}
                          onChange={(e) => setDatabaseUrl(e.target.value)}
                          rows={2}
                          className="font-mono text-[10px] min-h-[48px] resize-none"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Modules */}
                  <Card className="border-border/60">
                    <CardHeader className="p-3 pb-0">
                      <div className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enabled Modules</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-2 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {enabledModules.map((module) => (
                          <Badge key={module} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1">
                            {module}
                            <button onClick={() => handleRemoveModule(module)} className="hover:text-destructive">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                        {enabledModules.length === 0 && (
                          <p className="text-[10px] text-muted-foreground">No modules enabled</p>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="Add module (e.g., crm)"
                          value={newModule}
                          onChange={(e) => setNewModule(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddModule()}
                          className="h-7 text-xs"
                        />
                        <Button onClick={handleAddModule} variant="outline" size="sm" className="h-7 text-xs px-2">
                          <Plus className="h-3 w-3 mr-1" />Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="h-7 text-xs px-3 shadow-sm"
                    disabled={isMutating}
                  >
                    {isMutating ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-1.5" />
                    )}
                    Save Tenant Settings
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ── Branding Tab ── */}
            <TabsContent value="branding" className="mt-3">
              <div className="space-y-3">
                {/* Header Colors */}
                <Card className="border-border/60">
                  <CardHeader className="p-3 pb-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Header Colors</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground">Background</Label>
                          <div className="flex items-center gap-1.5">
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
                              className="w-3 h-3 rounded"
                            />
                            <Label htmlFor="headerUseGradient" className="text-[10px] font-normal cursor-pointer text-muted-foreground">
                              Gradient
                            </Label>
                          </div>
                        </div>
                        {headerUseGradient ? (
                          <Textarea
                            value={headerBgColor}
                            onChange={(e) => setHeaderBgColor(e.target.value)}
                            placeholder="linear-gradient(to right, #3b82f6, #8b5cf6)"
                            rows={1}
                            className="font-mono text-[10px] min-h-[32px] resize-none"
                          />
                        ) : (
                          <div className="flex gap-1.5">
                            <Input
                              type="color"
                              value={headerBgColor}
                              onChange={(e) => setHeaderBgColor(e.target.value)}
                              className="w-8 h-8 cursor-pointer p-0.5"
                            />
                            <Input
                              type="text"
                              value={headerBgColor}
                              onChange={(e) => setHeaderBgColor(e.target.value)}
                              className="h-8 text-xs flex-1 font-mono"
                            />
                          </div>
                        )}
                        <div className="h-6 rounded border" style={{ background: headerBgColor }} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground">Text Color</Label>
                        <div className="flex gap-1.5">
                          <Input
                            type="color"
                            value={headerTextColor}
                            onChange={(e) => setHeaderTextColor(e.target.value)}
                            className="w-8 h-8 cursor-pointer p-0.5"
                          />
                          <Input
                            type="text"
                            value={headerTextColor}
                            onChange={(e) => setHeaderTextColor(e.target.value)}
                            className="h-8 text-xs flex-1 font-mono"
                          />
                        </div>
                        <div className="h-6 rounded border flex items-center justify-center text-[10px] font-medium" style={{ background: headerBgColor, color: headerTextColor }}>
                          Preview Text
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Footer Colors */}
                <Card className="border-border/60">
                  <CardHeader className="p-3 pb-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Footer Colors</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground">Background</Label>
                          <div className="flex items-center gap-1.5">
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
                              className="w-3 h-3 rounded"
                            />
                            <Label htmlFor="footerUseGradient" className="text-[10px] font-normal cursor-pointer text-muted-foreground">
                              Gradient
                            </Label>
                          </div>
                        </div>
                        {footerUseGradient ? (
                          <Textarea
                            value={footerBgColor}
                            onChange={(e) => setFooterBgColor(e.target.value)}
                            placeholder="linear-gradient(to right, #3b82f6, #8b5cf6)"
                            rows={1}
                            className="font-mono text-[10px] min-h-[32px] resize-none"
                          />
                        ) : (
                          <div className="flex gap-1.5">
                            <Input
                              type="color"
                              value={footerBgColor}
                              onChange={(e) => setFooterBgColor(e.target.value)}
                              className="w-8 h-8 cursor-pointer p-0.5"
                            />
                            <Input
                              type="text"
                              value={footerBgColor}
                              onChange={(e) => setFooterBgColor(e.target.value)}
                              className="h-8 text-xs flex-1 font-mono"
                            />
                          </div>
                        )}
                        <div className="h-6 rounded border" style={{ background: footerBgColor }} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground">Text Color</Label>
                        <div className="flex gap-1.5">
                          <Input
                            type="color"
                            value={footerTextColor}
                            onChange={(e) => setFooterTextColor(e.target.value)}
                            className="w-8 h-8 cursor-pointer p-0.5"
                          />
                          <Input
                            type="text"
                            value={footerTextColor}
                            onChange={(e) => setFooterTextColor(e.target.value)}
                            className="h-8 text-xs flex-1 font-mono"
                          />
                        </div>
                        <div className="h-6 rounded border flex items-center justify-center text-[10px] font-medium" style={{ background: footerBgColor, color: footerTextColor }}>
                          Preview Text
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="h-7 text-xs px-3 shadow-sm"
                    disabled={isMutating}
                  >
                    {isMutating ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3 mr-1.5" />
                    )}
                    Save Branding
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ── Currency Tab ── */}
            <TabsContent value="currency" className="mt-3">
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
              <div className="flex justify-end mt-3">
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="h-7 text-xs px-3 shadow-sm"
                  disabled={isMutating}
                >
                  {isMutating ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1.5" />
                  )}
                  Save Currency
                </Button>
              </div>
            </TabsContent>

            {/* ── WhatsApp Tab ── */}
            <TabsContent value="whatsapp" className="mt-3">
              <WhatsAppDefaultsTab
                whatsappDefaults={whatsappDefaults}
                onWhatsAppDefaultsChange={setWhatsappDefaults}
                onSave={saveWhatsAppDefaults}
                isSaving={isSavingPreferences}
              />
            </TabsContent>

            {/* ── User Preferences Tab ── */}
            <TabsContent value="user" className="mt-3">
              <div className="space-y-3">
                <Card className="border-border/60">
                  <CardHeader className="p-3 pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">User Preferences</CardTitle>
                      </div>
                      <div className="flex gap-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={fetchUserPreferences}
                              disabled={userPreferencesLoading}
                            >
                              {userPreferencesLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">Refresh</p></TooltipContent>
                        </Tooltip>
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={saveUserPreferences}
                          disabled={isSavingPreferences || userPreferencesLoading}
                        >
                          {isSavingPreferences ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3 mr-1" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    {userPreferencesLoading && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground ml-2">Loading...</span>
                      </div>
                    )}

                    {userPreferencesError && (
                      <div className="flex items-center gap-1.5 p-2 border border-destructive/50 rounded-md bg-destructive/5">
                        <AlertCircle className="h-3 w-3 text-destructive" />
                        <p className="text-xs text-destructive">{userPreferencesError}</p>
                      </div>
                    )}

                    {userPreferencesData && !userPreferencesLoading && (
                      <div className="space-y-3">
                        {/* Theme Toggle */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Theme</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant={editedPreferences.theme === 'light' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updatePreferenceValue('theme', 'light')}
                              className="h-7 text-xs gap-1.5"
                            >
                              <Sun className="h-3 w-3" />
                              Light
                            </Button>
                            <Button
                              type="button"
                              variant={editedPreferences.theme === 'dark' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updatePreferenceValue('theme', 'dark')}
                              className="h-7 text-xs gap-1.5"
                            >
                              <Moon className="h-3 w-3" />
                              Dark
                            </Button>
                            {editedPreferences.theme && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                {editedPreferences.theme}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Custom Preferences */}
                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Custom Preferences</Label>
                          <div className="space-y-1.5">
                            {Object.entries(editedPreferences)
                              .filter(([key]) => key !== 'theme')
                              .map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                                  <div className="flex-1 grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Key</p>
                                      <p className="text-xs font-medium truncate">{key}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Value</p>
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
                                        className="h-6 text-xs"
                                      />
                                    </div>
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeCustomPreference(key)}
                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p className="text-xs">Remove</p></TooltipContent>
                                  </Tooltip>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Add New Preference */}
                        <div className="border-t border-border/40 pt-2">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Add New Preference</Label>
                          <div className="flex items-end gap-1.5 mt-1">
                            <div className="flex-1 space-y-0.5">
                              <Label className="text-[10px] text-muted-foreground">Key</Label>
                              <Input
                                placeholder="e.g., language"
                                value={newPrefKey}
                                onChange={(e) => setNewPrefKey(e.target.value)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="flex-1 space-y-0.5">
                              <Label className="text-[10px] text-muted-foreground">Value</Label>
                              <Input
                                placeholder="Enter value"
                                value={newPrefValue}
                                onChange={(e) => setNewPrefValue(e.target.value)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={addCustomPreference}
                              size="sm"
                              className="h-7 text-xs px-2"
                            >
                              <Plus className="h-3 w-3 mr-1" />Add
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {!userPreferencesData && !userPreferencesLoading && !userPreferencesError && (
                      <div className="text-center py-6 text-muted-foreground">
                        <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Click the tab to load preferences</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* User Info Card */}
                {userPreferencesData && (
                  <Card className="border-border/60">
                    <CardHeader className="p-3 pb-0">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">User Information</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Email</p>
                          <p className="text-xs font-medium truncate">{userPreferencesData.email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Name</p>
                          <p className="text-xs font-medium">{userPreferencesData.first_name} {userPreferencesData.last_name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Timezone</p>
                          <p className="text-xs font-medium">{userPreferencesData.timezone || 'Not set'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Status</p>
                          <Badge
                            variant={userPreferencesData.is_active ? 'default' : 'secondary'}
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
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
    </TooltipProvider>
  );
};
