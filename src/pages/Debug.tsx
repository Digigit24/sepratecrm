// src/pages/Debug.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

export const Debug: React.FC = () => {
  // Get current user from auth context
  const { user, isAuthenticated } = useAuth();

  // Get tokens from localStorage
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  // Get full user data from localStorage if available
  const storedUser = localStorage.getItem('user');
  const userData = storedUser ? JSON.parse(storedUser) : null;

  // Construct the full auth response as it would come from login
  const authResponse = {
    message: 'Login successful',
    user: userData || user,
    tokens: {
      access: accessToken,
      refresh: refreshToken,
    },
    authenticated: isAuthenticated,
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Debug Screen</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Auth Login Response - Raw Data
          </p>
        </div>
        <Badge variant={isAuthenticated ? 'default' : 'destructive'} className="w-fit">
          {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
        </Badge>
      </div>

      {/* Auth Response */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Full Auth Login Response</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(authResponse, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* User Object Only */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Object</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(userData || user, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Tokens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">JWT Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Access Token:</p>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs font-mono break-all">
                {accessToken || 'Not found'}
              </pre>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Refresh Token:</p>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs font-mono break-all">
                {refreshToken || 'Not found'}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LocalStorage Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All LocalStorage Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(
              Object.keys(localStorage).reduce((acc, key) => {
                acc[key] = localStorage.getItem(key);
                return acc;
              }, {} as Record<string, string | null>),
              null,
              2
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};
