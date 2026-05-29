# CRM Frontend App Summary: `sepratecrm`

Generated from local codebase on 2026-05-28.

## App Identity

| Item | Value |
| --- | --- |
| App folder | `sepratecrm/` |
| App type | Frontend CRM and WhatsApp workspace |
| Hosted URL | `https://kumsscrm.celiyo.com` |
| Stack | React 18, Vite, TypeScript, Tailwind, shadcn/Radix UI, Axios, TanStack Query, SWR, Laravel Echo/Pusher |
| Main entry | `src/App.tsx` |

`sepratecrm` is the browser frontend used by tenants/users. It is not the main data owner. It connects to multiple backend APIs depending on the module:

| Backend | Default base URL in code | Used for |
| --- | --- | --- |
| Auth/Admin API | `https://admin.celiyo.com/api` | Login, JWT refresh/verify/logout, user details, roles, tenants, tenant settings |
| CRM API | `https://crm.celiyo.com/api` | Leads, statuses, activities, tasks, meetings, CRM field configs, integrations |
| WhatsApp API | `https://whatsappapi.celiyo.com/api` | WhatsApp contacts, chats, templates, campaigns, bot flows, scheduling, webhooks, realtime auth |
| HMS API | `https://hms.celiyo.com/api` | Present in config for compatibility, not active for this CRM app |

These URLs can be overridden with Vite env vars in `.env` / `.env.local`:

```text
VITE_AUTH_BASE_URL
VITE_CRM_BASE_URL
VITE_HMS_BASE_URL
VITE_WHATSAPP_BASE_URL
VITE_WHATSAPP_EXTERNAL_BASE_URL
VITE_WHATSAPP_WS_URL
VITE_LARAVEL_APP_URL
```

## What This App Does

The app provides a protected CRM workspace with these major areas:

- Dashboard.
- CRM leads, lead details, lead statuses, CRM tasks, activities, meetings, field configuration.
- WhatsApp module: onboarding, contacts, chats, groups, templates, campaigns, Meta WhatsApp Flows, bot flow builder, QR codes, scheduling.
- Admin module: users, roles, settings, debug.
- Integrations module: integration connections, workflows, workflow logs, OAuth callback.

## Frontend Route Map

Routes are declared in `src/App.tsx`.

### Public Route

| Route | Purpose |
| --- | --- |
| `/login` | Login screen. Redirects authenticated users to `/`. |

### Protected App Shell

All non-login routes are wrapped in `ProtectedRoute`, which checks local auth state through `useAuth` and `authService`.

| Route group | Guard |
| --- | --- |
| `/crm/*` | `ModuleProtectedRoute requiredModule="crm"` |
| `/whatsapp/*` | `ModuleProtectedRoute requiredModule="whatsapp"` |
| `/admin/*` | `ModuleProtectedRoute requiredModule="admin"` |
| `/integrations/*` | `ModuleProtectedRoute requiredModule="integrations"` |

### CRM Routes

| Route | Page |
| --- | --- |
| `/` | `Dashboard` |
| `/crm/leads` | `CRMLeads` |
| `/crm/leads/:leadId` | `LeadDetailsPage` |
| `/crm/activities` | `CRMActivities` |
| `/crm/statuses` | `CRMLeadStatuses` |
| `/crm/settings` | `CRMFieldConfigurations` |
| `/crm/tasks` | `CRMTasks` |
| `/crm/meetings` | `Meetings` |
| `/crm/pipeline` | Redirects to `/crm/leads` |

### WhatsApp Routes

| Route | Page |
| --- | --- |
| `/whatsapp/onboarding` | `WhatsAppOnboarding` |
| `/whatsapp/contacts` | `Contacts` |
| `/whatsapp/chats` | `Chats` |
| `/whatsapp/groups` | `Groups` |
| `/whatsapp/templates` | `Templates` |
| `/whatsapp/campaigns` | `Campaigns` |
| `/whatsapp/flows` | `Flows` |
| `/whatsapp/flows/:flow_id` | `FlowEditor` |
| `/whatsapp/bot-flows` | `BotFlows` |
| `/whatsapp/bot-flows/:flowId` | `BotFlowBuilder` |
| `/whatsapp/qrcode` | `QRCodes` |
| `/whatsapp/scheduling` | `Scheduling` |

## Auth Model and Token Usage

### Login Source

The frontend logs in through:

```text
POST https://admin.celiyo.com/api/auth/login/
```

Relevant files:

- `src/services/authService.ts`
- `src/lib/client.ts`
- `src/lib/apiConfig.ts`

The login response is expected to return:

- `tokens.access`
- `tokens.refresh`
- `user`

The frontend stores:

| localStorage key | Value |
| --- | --- |
| `celiyo_access_token` | Main login JWT access token |
| `celiyo_refresh_token` | Refresh token |
| `celiyo_user` | User object with tenant, roles, preferences, enabled modules, WhatsApp settings |

### After Login Enrichment

After login, `authService.login()` fetches:

1. User detail from Auth API:

   ```text
   GET /users/:id/
   ```

   Used for preferences when not present in login response.

2. Tenant detail from Auth API:

   ```text
   GET /tenants/:id/
   ```

   Used to read tenant settings:

   - `whatsapp_vendor_uid`
   - `whatsapp_api_token`

These tenant settings are added into `celiyo_user.tenant`.

### Module Access

`ModuleProtectedRoute` checks whether the tenant has the requested module enabled.

The module list is read from:

- `celiyo_user.tenant.enabled_modules`, or
- decoded `celiyo_access_token.enabled_modules`.

Superadmin access can be inferred from `is_super_admin` in the decoded access token.

## API Clients and Who Uses What

### Auth Client

File: `src/lib/client.ts`

Base URL:

```text
https://admin.celiyo.com/api
```

Uses:

- Login, logout, token refresh, token verify.
- Users, roles, tenants, tenant settings.
- Adds `Authorization: Bearer {celiyo_access_token}` when a token exists.
- Adds tenant headers from `celiyo_user.tenant`:
  - `X-Tenant-Id`
  - `x-tenant-id`
  - `tenanttoken`
  - `X-Tenant-Slug`

### CRM Client

File: `src/lib/client.ts`

Base URL:

```text
https://crm.celiyo.com/api
```

Uses:

- CRM leads.
- Lead statuses.
- Lead activities.
- Lead order/Kanban.
- Tasks.
- Meetings.
- Field configuration.
- Integration connections and workflows.

Auth:

- Sends `Authorization: Bearer {celiyo_access_token}`.
- Sends tenant headers from `celiyo_user.tenant`.
- On 401, attempts token refresh through Auth API, then retries the original CRM request.

### WhatsApp External Client

File: `src/lib/externalWhatsappClient.ts`

Base URL:

```text
https://whatsappapi.celiyo.com/api
```

Uses:

- Laravel WhatsApp backend routes scoped by vendor UID.
- This is the main WhatsApp integration path.

Auth:

- Reads `celiyo_user.tenant.whatsapp_api_token`.
- Sends `Authorization: Bearer {whatsapp_api_token}`.
- Does not fall back to the normal login JWT for vendor API requests.
- Sends tenant headers:
  - `X-Tenant-Id`
  - `tenanttoken`
  - `X-Tenant-Slug`

Vendor scoping:

- Reads `celiyo_user.tenant.whatsapp_vendor_uid`.
- Builds URLs like:

```text
/api/{whatsapp_vendor_uid}/contacts
/api/{whatsapp_vendor_uid}/chat/contacts
/api/{whatsapp_vendor_uid}/templates
/api/{whatsapp_vendor_uid}/campaigns
```

### Legacy WhatsApp Client

File: `src/lib/whatsappClient.ts`

Base URL:

```text
https://whatsappapi.celiyo.com/api
```

This client sends the normal login access token and tenant headers. Many constants under `API_CONFIG.WHATSAPP` are marked as legacy in `src/lib/apiConfig.ts`; the current Laravel vendor API integration mostly uses `WHATSAPP_EXTERNAL` through `externalWhatsappClient` and `externalWhatsappService`.

## WhatsApp Frontend Module

### Main Service Files

| File | Role |
| --- | --- |
| `src/services/externalWhatsappService.ts` | Main Laravel WhatsApp API wrapper for contacts, labels, groups, templates, campaigns, chat, media, message logs. |
| `src/lib/externalWhatsappClient.ts` | Axios client using `whatsapp_api_token`. |
| `src/services/whatsapp.ts` | Media upload/send helpers. |
| `src/services/whatsapp/chatService.ts` | Chat module wrapper. |
| `src/services/whatsapp/contactsService.ts` | Contacts module wrapper. |
| `src/services/whatsapp/templatesService.ts` | Templates module wrapper. |
| `src/services/whatsapp/campaignsService.ts` | Campaigns module wrapper. |
| `src/services/whatsapp/groupsService.ts` | Groups module wrapper. |
| `src/services/whatsapp/flowsService.ts` | Meta WhatsApp Flows wrapper. |
| `src/services/whatsapp/botFlowService.ts` | Visual bot flow builder wrapper. |
| `src/services/whatsapp/qrCodesService.ts` | QR code wrapper. |
| `src/services/whatsapp/messagesService.ts` | Message wrapper. |

### Main Hooks

Hooks live under `src/hooks/whatsapp/`.

Important hooks:

- `useChatContacts`
- `useContactsWithInfiniteScroll`
- `useUnreadCount`
- `useTeamMembers`
- `useChatMessages`
- `useSendMessage`
- `useSendMediaMessage`
- `useSendTemplateMessage`
- `useMarkAsRead`
- `useClearChatHistory`
- `useAssignUser`
- `useAssignLabels`
- `useUpdateNotes`
- `useBlockContact`
- `useUnblockContact`
- `useBotSettings`
- `useChatContext`
- `useMessageLog`
- `useCampaigns`
- `useContacts`
- `useLabels`
- `useContactGroups`
- `useFlows`
- `useFlowStats`
- `useBotFlows`
- `useQRCodes`
- `useTemplates`
- `useRealtimeChat`

### WhatsApp API Calls

The frontend calls the WhatsApp backend at:

```text
https://whatsappapi.celiyo.com/api/{vendorUid}/...
```

Common endpoint groups:

| Frontend area | Backend endpoints |
| --- | --- |
| Contacts | `GET /{vendorUid}/contacts`, `GET /{vendorUid}/contacts/{contactUid}`, `POST /{vendorUid}/contacts/import`, `DELETE /{vendorUid}/contacts/{contactUid}` |
| Labels | `GET/POST /{vendorUid}/labels`, `PUT/DELETE /{vendorUid}/labels/{labelUid}` |
| Groups | `GET/POST /{vendorUid}/contact-groups`, `PUT/DELETE /{vendorUid}/contact-groups/{groupUid}` |
| Chat | `GET /{vendorUid}/chat/contacts`, `GET /{vendorUid}/contacts/{contactUid}/messages`, `POST /{vendorUid}/contacts/{contactUid}/messages` |
| Media | `POST /{vendorUid}/media/upload`, `GET /{vendorUid}/media/{filename}` |
| Templates | `GET/POST /{vendorUid}/templates`, `PUT/DELETE /{vendorUid}/templates/{templateUid}`, `POST /{vendorUid}/templates/sync` |
| Campaigns | `GET/POST /{vendorUid}/campaigns`, `GET /{vendorUid}/campaigns/{campaignUid}/status`, archive/unarchive/delete |
| Bot flows | `GET/POST /{vendorUid}/bot-flows`, builder save, node CRUD |
| Meta flows | `GET/POST /{vendorUid}/flows`, publish/unpublish/validate/duplicate |
| Scheduling | event and message scheduling under `/{vendorUid}/events/*`, `/{vendorUid}/messages/scheduled*`, `/{vendorUid}/scheduling/*` |

## Realtime/Pusher Usage

Files:

- `src/services/pusherService.ts`
- `src/context/RealtimeChatProvider.tsx`
- `src/hooks/whatsapp/useRealtimeChat.ts`

Purpose:

- Listen for WhatsApp message/contact updates.
- Invalidate unread counts and chat contact lists when new incoming messages arrive.
- Update message statuses.

Pusher settings in frontend:

```text
key=649db422ae8f2e9c7a9d
cluster=ap2
forceTLS=true
```

Broadcast auth endpoint:

```text
POST https://whatsappapi.celiyo.com/api/broadcasting/auth
```

Auth for broadcasting:

- `pusherService.ts` uses `celiyo_user.tenant.whatsapp_api_token` as the bearer token.
- It subscribes to the private vendor channel:

```text
private-vendor-channel.{vendorUid}
```

Main event listened:

```text
.VendorChannelBroadcast
```

## Important Frontend Data Dependencies

For WhatsApp features to work, the Auth/Admin API must provide tenant settings:

```json
{
  "settings": {
    "whatsapp_vendor_uid": "...",
    "whatsapp_api_token": "..."
  }
}
```

Without `whatsapp_vendor_uid`, the frontend cannot build Laravel WhatsApp URLs.

Without `whatsapp_api_token`, the Laravel WhatsApp backend rejects vendor-scoped API calls.

## Key Local Files

```text
sepratecrm/
  src/App.tsx
  src/lib/apiConfig.ts
  src/lib/client.ts
  src/lib/externalWhatsappClient.ts
  src/lib/whatsappClient.ts
  src/services/authService.ts
  src/services/externalWhatsappService.ts
  src/services/whatsapp/
  src/hooks/whatsapp/
  src/context/RealtimeChatProvider.tsx
  src/services/pusherService.ts
  src/pages/
  src/components/
```

## Integration Summary

`sepratecrm` is the browser UI hosted at `kumsscrm.celiyo.com`. It authenticates against `admin.celiyo.com/api`, gets the user's tenant/module context, then calls `crm.celiyo.com/api` for CRM data and `whatsappapi.celiyo.com/api` for WhatsApp data. WhatsApp uses a separate tenant-level vendor API token, not just the login JWT.

