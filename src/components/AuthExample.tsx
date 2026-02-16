// src/components/AuthExample.tsx
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const AuthExample: React.FC = () => {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error, 
    login, 
    logout, 
    hasModuleAccess, 
    getTenant, 
    getUserRoles 
  } = useAuth();

  const { 
    hasCRMAccess, 
    useLeads, 
    isLoading: crmLoading, 
    error: crmError 
  } = useCRM();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Fetch leads if user has CRM access
  const { data: leadsData, error: leadsError, mutate: mutateLeads } = useLeads({
    page: 1,
    page_size: 10
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Login to Celiyo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const tenant = getTenant();
  const roles = getUserRoles();

  return (
    <div className="space-y-6">
      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <strong>Email:</strong> {user?.email}
          </div>
          <div>
            <strong>User ID:</strong> {user?.id}
          </div>
          
          {/* Tenant Info */}
          {tenant && (
            <div className="space-y-2">
              <div>
                <strong>Tenant:</strong> {tenant.name} ({tenant.slug})
              </div>
              <div>
                <strong>Enabled Modules:</strong>
                <div className="flex gap-2 mt-1">
                  {tenant.enabled_modules.map((module) => (
                    <Badge key={module} variant="secondary">
                      {module}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Roles */}
          {roles.length > 0 && (
            <div>
              <strong>Roles:</strong>
              <div className="flex gap-2 mt-1">
                {roles.map((role) => (
                  <Badge key={role.id} variant="outline">
                    {role.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </CardContent>
      </Card>

      {/* Module Access */}
      <Card>
        <CardHeader>
          <CardTitle>Module Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <strong>CRM Access:</strong> 
              <Badge variant={hasCRMAccess ? "default" : "destructive"} className="ml-2">
                {hasCRMAccess ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div>
              <strong>WhatsApp Access:</strong> 
              <Badge variant={hasModuleAccess('whatsapp') ? "default" : "destructive"} className="ml-2">
                {hasModuleAccess('whatsapp') ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CRM Data Example */}
      {hasCRMAccess && (
        <Card>
          <CardHeader>
            <CardTitle>CRM Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {crmLoading && <div>Loading CRM data...</div>}
            {crmError && <div className="text-red-500">CRM Error: {crmError}</div>}
            {leadsError && <div className="text-red-500">Leads Error: {leadsError.message}</div>}
            
            {leadsData && (
              <div className="space-y-2">
                <div>
                  <strong>Total Leads:</strong> {leadsData.count}
                </div>
                <div>
                  <strong>Current Page Results:</strong> {leadsData.results.length}
                </div>
                
                {leadsData.results.length > 0 && (
                  <div className="space-y-2">
                    <strong>Recent Leads:</strong>
                    {leadsData.results.slice(0, 3).map((lead) => (
                      <div key={lead.id} className="p-2 border rounded">
                        <div><strong>{lead.name}</strong></div>
                        <div className="text-sm text-gray-600">
                          {lead.email} | {lead.phone}
                        </div>
                        <div className="text-sm">
                          Company: {lead.company} | Priority: {lead.priority}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <Button 
                  onClick={() => mutateLeads()} 
                  variant="outline" 
                  size="sm"
                >
                  Refresh Leads
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};