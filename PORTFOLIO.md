# Celiyo CRM - Portfolio Brief

## One-Liner

A multi-tenant CRM + WhatsApp Business platform for sales teams to manage leads, automate messaging campaigns, and build workflow automations — all in one place.

---

## The Problem We Solve

Businesses juggle disconnected tools for sales tracking, WhatsApp communication, and workflow automation. Sales teams lose leads, miss follow-ups, and waste hours switching between platforms. Celiyo unifies everything into a single, real-time platform.

---

## Key Highlights (For Client Pitch)

| Metric | Detail |
|--------|--------|
| Modules | 4 core modules (CRM, WhatsApp, Integrations, Admin) |
| Pages | 31+ fully functional pages |
| API Services | 20+ backend services |
| Real-time | WebSocket-powered live updates |
| Architecture | Multi-tenant, multi-service microservices |
| Auth | JWT with role-based access control |

---

## Core Features

### 1. CRM & Sales Pipeline
- **Lead Management** — Full CRUD with scoring (0-100), priority levels, custom fields, bulk operations, and CSV/JSON import-export
- **Kanban + Table Views** — Drag-and-drop pipeline boards alongside sortable data tables
- **Activity Tracking** — Log calls, emails, meetings, notes, and SMS against each lead
- **Task Management** — Create, assign, and track tasks with Kanban board view (TODO / In Progress / Done / Cancelled)
- **Meeting Scheduler** — Schedule and manage meetings linked to leads with calendar view
- **Custom Pipeline Stages** — Fully configurable statuses with color coding and Won/Lost tracking
- **Custom Fields** — 13+ field types (Text, Number, Email, Phone, Date, Dropdown, Multi-Select, Currency, etc.)

### 2. WhatsApp Business Suite
- **Real-time Chat** — Full messaging interface with media support, read receipts, and 24-hour conversation window awareness
- **Message Templates** — Create, manage, and track Meta-approved templates across Marketing, Utility, and Authentication categories
- **Bulk Campaigns** — Broadcast messages to thousands of contacts with delivery/read tracking
- **WhatsApp Flows** — Visual flow builder for sign-ups, lead generation, booking, surveys, and support
- **Contact & Group Management** — Labels, notes, assignment, and profile tracking
- **QR Code Generator** — Generate QR codes with pre-filled messages for offline marketing
- **Message Scheduling** — Schedule messages and event-based reminders with timezone support

### 3. Workflow Automation (Zapier-like)
- **Visual Workflow Builder** — Drag-and-drop trigger-action workflows
- **Trigger Types** — New/Updated Google Sheet Row, Webhooks, Schedules, Manual triggers
- **Action Types** — Create/Update Leads, Create Contacts, Send Email/SMS, Fire Webhooks
- **Data Mapping** — Map fields between triggers and actions with transformation support
- **Execution Logs** — Full audit trail of every workflow run with success/failure tracking
- **Google Sheets Integration** — OAuth-connected, read/write spreadsheet data

### 4. Admin & Multi-Tenancy
- **User Management** — Create users, assign roles, activate/deactivate accounts
- **Role-Based Access Control** — Granular permissions per module and action
- **Tenant Configuration** — Custom branding (logo, colors), feature toggles per organization
- **Module-Level Access** — Enable/disable CRM, WhatsApp, Integrations per tenant

---

## Tech Stack

### Frontend
- **React 18** + **TypeScript** — Type-safe, component-driven UI
- **Vite** — Lightning-fast build tooling
- **Tailwind CSS** + **Shadcn UI** + **Radix Primitives** — Production-grade design system
- **Zustand** + **React Query** + **SWR** — Multi-layered state management
- **Pusher** + **Laravel Echo** — Real-time WebSocket communication
- **@dnd-kit** — Drag-and-drop for Kanban boards and workflows
- **ApexCharts** + **Recharts** — Analytics dashboards
- **react-hook-form** + **Zod** — Validated, performant forms

### Backend (Microservices)
- **Django** — Auth service, CRM service, Integration service
- **FastAPI** + **Laravel** — WhatsApp messaging service
- **JWT Authentication** — Access + refresh token flow with auto-renewal
- **WebSocket** — Real-time event broadcasting

### Infrastructure
- Multi-service API architecture (4 independent backend services)
- Multi-tenant data isolation
- OAuth 2.0 for third-party integrations

---

## Architecture Overview

```
Client (React SPA)
    |
    +-- Auth Service (Django)       → JWT, Users, Roles, Permissions
    +-- CRM Service (Django)        → Leads, Activities, Tasks, Meetings
    +-- WhatsApp Service (FastAPI + Laravel) → Messaging, Templates, Campaigns, Flows
    +-- Integration Service (Django) → Workflows, Google Sheets, Webhooks
    |
    +-- Real-time Layer (Pusher WebSocket) → Live chat, notifications, updates
```

---

## Pages Built (31+)

| Module | Pages |
|--------|-------|
| Dashboard | Overview with metrics, charts, recent activity |
| CRM | Leads (Kanban + Table), Lead Detail, Activities, Tasks, Meetings, Pipeline Statuses, Field Settings |
| WhatsApp | Onboarding, Contacts, Chats, Groups, Templates, Campaigns, Flow Builder, QR Codes, Scheduling |
| Integrations | Catalog, Workflow Builder, Workflow Editor, Execution Logs, OAuth Callback |
| Admin | Users, Roles, Tenant Settings, Debug Tools |
| Auth | Login, 404 |

---

## What Makes This Stand Out

1. **All-in-one platform** — CRM + WhatsApp + Automation in a single product, not 3 separate tools
2. **Real-time everything** — WebSocket-powered live chat, lead updates, and notifications
3. **Multi-tenant ready** — Built for SaaS from day one with tenant isolation and per-org configuration
4. **WhatsApp-native** — Not a bolt-on; deep integration with Meta's Business API including Flows, Templates, and Campaigns
5. **Workflow engine** — Zapier-like automation without leaving the platform
6. **Enterprise-grade UI** — Shadcn + Radix design system with dark mode, responsive layouts, and accessibility
7. **Modular architecture** — Enable only what each client needs; each module is independently toggleable
8. **Custom fields & pipeline** — Fully configurable to match any sales process

---

## Client Pitch Script (30-second version)

> "Celiyo is a CRM built for WhatsApp-first businesses. Your sales team manages leads, runs WhatsApp campaigns, and automates workflows — all from one dashboard. It's multi-tenant, real-time, and built on a modern React + Django + FastAPI stack. We built 31+ pages, 20+ API services, and a full WhatsApp Business integration including template management, bulk campaigns, and a visual flow builder. It's ready to white-label for your brand."

---

## Client Pitch Script (60-second version)

> "We built Celiyo — a full-stack, multi-tenant CRM platform designed for sales teams that rely on WhatsApp.
>
> On the CRM side, you get lead management with scoring, custom fields, a Kanban pipeline, task tracking, meeting scheduling, and activity logging — everything a sales team needs to close deals.
>
> On the WhatsApp side, it's a complete business suite: real-time chat, Meta-approved message templates, bulk campaigns with delivery tracking, a visual flow builder for lead generation and support, QR code generation, and message scheduling.
>
> We also built a Zapier-like workflow engine — connect Google Sheets, webhooks, and external APIs to automate lead creation, notifications, and data sync.
>
> The platform is multi-tenant with role-based access control, custom branding per organization, and module-level feature toggles. The frontend is React + TypeScript with a Shadcn design system, and the backend runs on Django + FastAPI microservices with real-time WebSocket updates.
>
> It's production-ready, white-label-friendly, and built to scale."

---

## Deliverables Summary

- 31+ pages (fully responsive, dark/light mode)
- 4 core modules (CRM, WhatsApp, Integrations, Admin)
- 20+ API service integrations
- Real-time WebSocket communication
- Multi-tenant architecture with RBAC
- Workflow automation engine
- Full WhatsApp Business API integration
- Production-grade design system (Shadcn + Radix + Tailwind)
- JWT authentication with token refresh
- CSV/JSON import-export
- PDF generation and printing support
- Chart-based analytics dashboards
