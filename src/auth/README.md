# Celiyo Multi-Tenant Authentication System

This document describes the new authentication architecture for Celiyo, which supports multi-tenant login with separate Django apps for authentication and CRM.

## Architecture Overview

The new system consists of:
- **Auth API** (`https://admin.celiyo.com/api`) - Handles authentication, user management, and tenant management
- **CRM API** (`https://crm.celiyo.com/api`) - Handles CRM operations with JWT-based authorization

## Key Features

- **JWT-based Authentication** - Uses access and refresh tokens
- **Multi-tenant Support** - Each user belongs to a tenant with specific modules enabled
- **Module-based Access Control** - Users can access different modules (CRM, WhatsApp, etc.) based on tenant configuration
- **Automatic Token Refresh** - Seamless token refresh for CRM API calls
- **Role-based Permissions** - Users have roles that determine their permissions

## API Endpoints

### Authentication (Auth API)

#### Login
```http
POST https://admin.celiyo.com/api/auth/login/
Content-Type: application/json

{
  "email": "john@acmecorp.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "abc-123",
    "email": "john@acmecorp.com",
    "tenant": {
      "id": "acme-456",
      "name": "Acme Corporation",
      "slug": "acme-corp",
      "enabled_modules": ["crm", "whatsapp"]
    },
    "roles": [
      {
        "id": "role-789",
        "name": "Sales Manager"
      }
    ]
  }
}
```

#### Refresh Token
```http
POST https://admin.celiyo.com/api/auth/token/refresh/
Content-Type: application/json

{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

#### Verify Token
```http
POST https://admin.celiyo.com/api/auth/token/verify/
Content-Type: application/json

{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

#### Logout
```http
POST https://admin.celiyo.com/api/auth/logout/
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
Content-Type: application/json

{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### CRM Operations (CRM API)

All CRM API calls require the `Authorization: Bearer <access_token>` header.

#### Get Leads
```http
GET https://crm.celiyo.com/api/leads/
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

## Usage Examples

### Basic Authentication

```typescript
import { useAuth } from '@/hooks/useAuth';

function LoginComponent() {
  const { login, user, isAuthenticated, logout } = useAuth();

  const handleLogin = async () => {
    try {
      await login({
        email: 'john@acmecorp.com',
        password: 'password123'
      });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (isAuthenticated) {
    return (
      <div>
        <h1>Welcome, {user?.email}</h1>
        <p>Tenant: {user?.tenant.name}</p>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }

  return <button onClick={handleLogin}>Login</button>;
}
```

### Module Access Control

```typescript
import { useAuth } from '@/hooks/useAuth';

function CRMComponent() {
  const { hasModuleAccess } = useAuth();

  if (!hasModuleAccess('crm')) {
    return <div>CRM module not enabled for your account</div>;
  }

  return <div>CRM Content</div>;
}
```

### CRM Operations

```typescript
import { useCRM } from '@/hooks/useCRM';

function LeadsComponent() {
  const { useLeads, createLead, hasCRMAccess } = useCRM();
  const { data: leads, error, mutate } = useLeads({ page: 1, page_size: 10 });

  if (!hasCRMAccess) {
    return <div>CRM access not available</div>;
  }

  const handleCreateLead = async () => {
    try {
      await createLead({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890'
      });
      mutate(); // Refresh the leads list
    } catch (error) {
      console.error('Failed to create lead:', error);
    }
  };

  return (
    <div>
      <button onClick={handleCreateLead}>Create Lead</button>
      {leads?.results.map(lead => (
        <div key={lead.id}>{lead.name}</div>
      ))}
    </div>
  );
}
```

## File Structure

```
src/
├── types/
│   └── authTypes.ts          # TypeScript types for auth
├── lib/
│   ├── apiConfig.ts          # API endpoints configuration
│   └── client.ts             # HTTP clients (auth & CRM)
├── services/
│   ├── authService.ts        # Authentication service
│   └── crmService.ts         # CRM service
├── hooks/
│   ├── useAuth.ts            # Authentication hook
│   └── useCRM.ts             # CRM operations hook
└── components/
    └── AuthExample.tsx       # Example component
```

## Key Components

### `authService`
- Handles login, logout, token refresh, and token verification
- Manages user data in localStorage
- Provides methods for checking authentication status

### `useAuth` Hook
- React hook for authentication state management
- Provides login, logout, and user data
- Includes module access checking methods

### `crmService`
- Handles all CRM API operations
- Uses the CRM client with automatic token refresh

### `useCRM` Hook
- React hook for CRM operations
- Includes SWR-based data fetching for leads
- Automatically checks CRM module access

## Token Management

- **Access Token**: Short-lived JWT token for API authorization
- **Refresh Token**: Long-lived token for obtaining new access tokens
- **Automatic Refresh**: CRM client automatically refreshes expired access tokens
- **Storage**: Tokens are stored in localStorage with prefixed keys

## Error Handling

- **401 Unauthorized**: Automatically triggers token refresh or logout
- **403 Forbidden**: Module access denied (e.g., CRM not enabled)
- **Network Errors**: Proper error propagation and logging

## Development Setup

For development, update the base URLs in `apiConfig.ts`:

```typescript
export const API_CONFIG = {
  AUTH_BASE_URL: 'http://localhost:8001/api',  // Auth Django app
  CRM_BASE_URL: 'http://localhost:8002/api',   // CRM Django app
  // ... rest of config
};
```

## Migration from Old System

The new system maintains backward compatibility with legacy token methods:
- `tokenManager.getToken()` → `tokenManager.getAccessToken()`
- `tokenManager.setToken()` → `tokenManager.setAccessToken()`
- `tokenManager.hasToken()` → `tokenManager.hasAccessToken()`

This allows for gradual migration of existing code.