---
title: "Cinder Analytics Platform"
subtitle: "Product Documentation — v3.2"
author: "Cinder Analytics, Inc."
date: "May 2026"
documentclass: report
geometry: margin=1in
fontsize: 11pt
linkcolor: "RoyalBlue"
toc: true
toc-depth: 2
numbersections: true
---

\newpage

# Revision History

| Version | Date           | Author        | Notes                                                        |
| ------- | -------------- | ------------- | ------------------------------------------------------------ |
| 3.2     | 2026-05-02     | Docs Team     | Added cohort retention API, updated Growth tier event cap.   |
| 3.1     | 2026-02-14     | Docs Team     | New HubSpot integration; expanded SDK reference.             |
| 3.0     | 2025-11-08     | Docs Team     | Major rewrite for the v3 query engine; deprecated v2 funnel endpoints. |
| 2.4     | 2025-08-19     | Docs Team     | SOC 2 Type II refresh; updated DPA template.                 |
| 2.0     | 2025-01-12     | Docs Team     | Initial release of the v2 platform.                          |

This document supersedes all prior revisions. Section numbering is stable across minor releases; major releases (3.0, 4.0) may reorganize chapters.

\newpage

# 1. Getting Started

## 1.1 What Cinder Analytics Is

Cinder Analytics is an event-based product analytics platform built for B2B SaaS teams. It captures user behavior across web and mobile applications, organizes it around a unified user model, and exposes the result through dashboards, an SQL-compatible query interface, and a REST API.

Customers use Cinder to answer four classes of question:

- **Funnel performance** — what fraction of users complete a defined sequence of events, and where do they drop off?
- **Retention** — of users who performed event A in week N, what fraction returned to perform event B in week N+1, N+2, ...?
- **Cohort behavior** — how does a slice of users defined by acquisition channel, plan, or region differ in downstream activity?
- **Feature adoption** — which accounts have used a feature, how recently, and how does adoption correlate with retention?

Cinder is not a general-purpose BI tool. It does not connect to your data warehouse, build executive dashboards from arbitrary SQL, or produce financial reports. Customers who need those should use Cinder alongside a warehouse-native BI tool such as Looker or Hex.

## 1.2 Account Setup

A new Cinder workspace is created when an admin user signs up at `https://app.cinder.io/signup` and verifies their email. The first user becomes the workspace owner and can invite additional members from **Settings → Members**.

Each workspace has:

- A unique **workspace ID** (e.g. `ws_8q3FkrLp2NwH`) used in API authentication.
- A **default project** representing one logical product (web app, marketing site, mobile app). Most customers create one project per app.
- An **environment** label (`development`, `staging`, `production`) that scopes events. Events sent to `development` never count against billed event volume.

## 1.3 First Event in 90 Seconds

The fastest path to seeing data in Cinder is to send a test event from the command line:

```bash
curl -X POST https://api.cinder.io/v3/events \
  -H "Authorization: Bearer cnd_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "event": "signup_completed",
    "user_id": "u_demo_001",
    "properties": { "plan": "starter", "source": "docs_quickstart" },
    "timestamp": "2026-05-02T10:00:00Z"
  }'
```

A `202 Accepted` response means the event was queued. It will appear in the Live View within 5 seconds and become queryable in dashboards within 60 seconds.

## 1.4 Recommended Setup Order

For a new project, we recommend completing setup in this order:

1. **Install an SDK** (Section 5) in your application. Start with one platform.
2. **Define your event taxonomy** (Section 2.2) before instrumenting. Renaming events later is supported but invalidates historical comparisons.
3. **Send a test event** in the `development` environment and verify it in Live View.
4. **Identify users** with `cinder.identify(user_id, traits)` so anonymous and authenticated activity stitch together.
5. **Build your first funnel** (Section 3.2) covering a critical conversion path: signup, activation, first paid action.
6. **Invite your team** and grant the `viewer` role to stakeholders before sharing dashboards.

\newpage

# 2. Core Concepts

## 2.1 The Event Model

Every observation in Cinder is an **event**: a named action attributed to a user, occurring at a specific time, with a flexible set of properties. The schema is intentionally narrow:

```json
{
  "event": "string, required",
  "user_id": "string, required (or anonymous_id)",
  "anonymous_id": "string, optional",
  "timestamp": "ISO 8601, required",
  "properties": "object, optional",
  "context": "object, optional (auto-populated by SDKs)"
}
```

Events are immutable once accepted. Corrections happen by sending a new event and filtering the corrupted batch out at query time using property filters.

## 2.2 Event Taxonomy

A good taxonomy is the single biggest determinant of analytics value. Cinder enforces no schema, but recommends:

- **Use `object_action` naming**: `account_created`, `report_exported`, `invoice_paid`. Avoid passive voice and avoid product-internal jargon.
- **Limit total event types to ~50** per project. More than that and dashboards become unbrowsable.
- **Use properties, not event names, for dimensions**. Send `report_exported` with `format: "csv"` rather than separate `report_exported_csv` and `report_exported_pdf` events.
- **Reserve a `version` property** on every event to make schema migrations possible without breaking historical queries.

## 2.3 Users and Identity

Cinder maintains two identity layers:

- **`anonymous_id`** — a stable identifier set by the SDK before login (typically a cookie or device ID). Used to track pre-signup behavior.
- **`user_id`** — your application's authenticated user ID. Sent via `cinder.identify()` after login.

When `identify()` is called, Cinder merges all prior `anonymous_id` events into the `user_id` profile. The merge is one-directional and idempotent. Re-identifying a different `user_id` from the same `anonymous_id` does not reassign history; it starts a new identity edge.

## 2.4 Sessions

A **session** is a contiguous sequence of events from one user with no gap longer than 30 minutes. Sessions are computed at query time, not stored as separate records. The threshold can be overridden per query in the v3 API.

Session-scoped properties such as `session_duration_seconds`, `session_event_count`, and `session_landing_page` are available as derived fields in dashboards and the SQL interface.

## 2.5 Cohorts

A **cohort** is a saved query that returns a set of users matching defined criteria, evaluated at a point in time or as a rolling window. Cohorts are first-class citizens in the platform: they can be referenced from funnels, retention curves, and segmentation breakdowns without re-specifying the criteria.

Cinder supports two cohort types:

- **Static cohorts** — evaluated once and frozen. Useful for tracking a specific intake batch (e.g. all users who signed up during a marketing campaign).
- **Dynamic cohorts** — re-evaluated on every query. Useful for tracking ongoing definitions (e.g. all users on the Growth plan).

\newpage

# 3. Dashboards & Reports

## 3.1 Dashboards

A **dashboard** is a saved arrangement of charts. Cinder supports four chart types: line (trend over time), bar (segment comparison), funnel (sequential conversion), and retention matrix.

Dashboards are scoped to a single project but can pull from multiple environments. A dashboard published to a workspace is visible to all members with the `viewer` role or above. Dashboards are not version-controlled; edits are immediate and overwrite the live view. Use the **Snapshot** feature (Section 3.5) to capture an immutable point-in-time view.

## 3.2 Funnel Reports

A funnel report measures conversion through an ordered sequence of events. The configuration consists of:

- **Steps** — between 2 and 12 events, in order. Each step can include a property filter.
- **Window** — the maximum time between the first and last step. Default is 7 days. Maximum is 90 days on the Growth plan, 365 days on Scale.
- **Cohort filter** — restrict the funnel population to a specific cohort.
- **Strict ordering** — if enabled, intervening events of other types disqualify the user. Default is loose ordering.

Funnel results are presented as both a step-by-step conversion chart and a Sankey-style flow diagram showing where users dropped off and (when available) what they did instead.

## 3.3 Retention Reports

Retention reports measure repeat behavior over time. The configuration is:

- **Initial event** — the action that defines the cohort (typically `signup_completed` or `first_value_reached`).
- **Return event** — the action that counts as retention. Often a key product action or simply `session_started`.
- **Period** — daily, weekly, or monthly. Cinder computes up to 26 periods.
- **Rolling vs. classic** — classic retention requires the user to perform the return event in the exact period; rolling retention requires it in any period from N onward.

The output is a triangular matrix where each row is a cohort (period N) and each column is a return period (N+1, N+2, ...). Hover on any cell to see the underlying user list.

## 3.4 Segmentation

Segmentation is the practice of comparing a metric across slices of the user base. Cinder allows segmentation by:

- Any user trait set via `identify()`.
- Any event property, aggregated to the user level (most recent value, first value, sum, count).
- Membership in any cohort.
- Acquisition source (UTM-derived).

Segmented charts can compare up to 8 groups simultaneously; beyond that, the chart auto-collapses tail groups into "Other".

## 3.5 Snapshots

A **snapshot** is an immutable, timestamped capture of a dashboard at a point in time. Snapshots are useful for:

- Board reporting (the chart can change after the meeting; the snapshot cannot).
- Historical comparison (compare current metrics to a snapshot from a quarter ago).
- Audit trail (prove what was reported when).

Snapshots are retained per the workspace's retention plan. Starter snapshots are kept 90 days; Growth snapshots 2 years; Scale snapshots indefinitely.

## 3.6 Sharing

Dashboards and individual charts can be shared in three ways:

1. **Internal share** — a link viewable only by workspace members (default).
2. **Public share** — a tokenized URL viewable by anyone with the link. Disabled by default; requires admin approval.
3. **Embed** — an iframe-friendly URL with optional row-level filtering via signed JWT. Used to embed Cinder in customer-facing portals.

\newpage

# 4. API Reference

The Cinder REST API is the canonical surface for all programmatic interaction. The base URL is `https://api.cinder.io/v3`. All requests must include a `Authorization: Bearer <token>` header.

API tokens are workspace-scoped and come in two flavors:

- **`cnd_live_*`** — full-access tokens for production use. Generated under **Settings → API**.
- **`cnd_test_*`** — sandboxed tokens that only see `development` environment data.

Rate limits are per-token: 1,000 requests per minute on Starter, 10,000 on Growth, custom on Scale. A `429 Too Many Requests` response includes a `Retry-After` header with the seconds to wait.

## 4.1 Events

### `POST /v3/events`

Send a single event.

**Request body**:

```json
{
  "event": "report_exported",
  "user_id": "u_2837_alice",
  "timestamp": "2026-05-02T10:14:32Z",
  "properties": {
    "report_type": "funnel",
    "format": "csv",
    "row_count": 1523
  }
}
```

**Response**: `202 Accepted` with body `{ "event_id": "evt_..." }`.

### `POST /v3/events/batch`

Send up to 1,000 events in a single request. The body is a JSON array of event objects. Partial success is reported via a per-event status array; the request returns `200 OK` even if some events were rejected (e.g. for missing required fields).

Latency for a 1,000-event batch is typically 80–120 ms. Events are validated synchronously; queryability follows the same 60-second SLA as single events.

## 4.2 Users

### `POST /v3/users/identify`

Set or update user traits.

```json
{
  "user_id": "u_2837_alice",
  "anonymous_id": "anon_a1b2c3",
  "traits": {
    "email": "alice@example.com",
    "plan": "growth",
    "company_id": "co_482"
  }
}
```

Traits are merged into the existing user record; existing traits not in the request are preserved. To delete a trait, send it as `null`.

### `GET /v3/users/{user_id}`

Returns the full user record including all traits, identity edges (linked anonymous IDs), first-seen and last-seen timestamps, and total event count. Available on Growth and Scale plans.

## 4.3 Funnels

### `POST /v3/queries/funnel`

Run an ad-hoc funnel query.

```json
{
  "steps": [
    { "event": "signup_completed" },
    { "event": "workspace_created" },
    { "event": "first_event_received" }
  ],
  "window_seconds": 604800,
  "date_range": { "from": "2026-04-01", "to": "2026-04-30" },
  "filters": [
    { "property": "plan", "op": "eq", "value": "growth" }
  ],
  "strict_ordering": false
}
```

**Response** includes per-step conversion counts, percentages, median time-to-step, and a sample of users at each drop-off point.

Note: as of v3.0 (released 2025-11-08), the legacy `/v2/funnel` endpoint is deprecated. It will continue to respond until 2026-12-31, at which point it returns `410 Gone`.

## 4.4 Cohorts

### `POST /v3/cohorts`

Create a cohort.

```json
{
  "name": "Active Growth Customers",
  "type": "dynamic",
  "definition": {
    "and": [
      { "trait": "plan", "op": "eq", "value": "growth" },
      { "event": "session_started", "in_last_days": 30, "min_count": 5 }
    ]
  }
}
```

### `GET /v3/cohorts/{id}/users`

Returns the current member list, paginated. The maximum page size is 1,000. Available since v3.2 (2026-05-02). Prior to 3.2, cohort membership was only accessible through dashboards.

## 4.5 Webhooks

Cinder can deliver events to your endpoint via webhook. Configure under **Settings → Webhooks**. Webhooks support filtering by event name and property predicates.

Each delivery is signed with HMAC-SHA256 using your webhook secret, sent in the `X-Cinder-Signature` header. Verify using:

```python
import hmac, hashlib
expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
assert hmac.compare_digest(expected, request.headers["X-Cinder-Signature"])
```

Failed deliveries are retried with exponential backoff for up to 24 hours, then dropped.

## 4.6 Errors

All error responses share a common shape:

```json
{
  "error": {
    "code": "invalid_argument",
    "message": "Field 'event' is required.",
    "request_id": "req_8f2a..."
  }
}
```

Always log `request_id` when reporting issues to support; it is the only key that resolves to a specific request in our internal logs.

\newpage

# 5. SDKs

Official SDKs are maintained for JavaScript (browser and Node), Python, iOS (Swift), and Android (Kotlin). All SDKs share the same five-method surface: `init`, `identify`, `track`, `page`/`screen`, and `flush`.

## 5.1 JavaScript

Install:

```bash
npm install @cinder/analytics
```

Initialize once at app startup:

```js
import { Cinder } from "@cinder/analytics";

const cinder = new Cinder({
  writeKey: process.env.CINDER_WRITE_KEY,
  environment: "production",
});

cinder.identify("u_2837_alice", { email: "alice@example.com", plan: "growth" });
cinder.track("report_exported", { format: "csv", row_count: 1523 });
```

The browser SDK auto-tracks page views unless `autoPageTracking: false` is passed. It also captures `referrer`, `utm_*`, and viewport dimensions on every event without configuration.

## 5.2 Python

Install:

```bash
pip install cinder-analytics
```

```python
from cinder_analytics import Cinder

cinder = Cinder(write_key=os.environ["CINDER_WRITE_KEY"], environment="production")

cinder.identify(user_id="u_2837_alice", traits={"plan": "growth"})
cinder.track(user_id="u_2837_alice", event="report_exported",
             properties={"format": "csv", "row_count": 1523})
cinder.flush()
```

The Python SDK is synchronous by default; pass `async_mode=True` to use a background thread that batches events and flushes every 5 seconds or every 100 events.

## 5.3 iOS (Swift)

Install via Swift Package Manager: `https://github.com/cinder-analytics/cinder-ios`.

```swift
import CinderAnalytics

Cinder.configure(writeKey: "cnd_live_...", environment: .production)
Cinder.shared.identify(userId: "u_2837_alice", traits: ["plan": "growth"])
Cinder.shared.track(event: "report_exported", properties: ["format": "csv"])
```

The iOS SDK persists events to disk and retries on next app launch if the device is offline at send time. Minimum supported iOS version is 14.0.

## 5.4 Android (Kotlin)

Add to `build.gradle`:

```gradle
implementation 'io.cinder:analytics:3.2.0'
```

```kotlin
Cinder.configure(this, writeKey = "cnd_live_...", environment = Environment.PRODUCTION)
Cinder.identify(userId = "u_2837_alice", traits = mapOf("plan" to "growth"))
Cinder.track(event = "report_exported", properties = mapOf("format" to "csv"))
```

Minimum Android API level is 24 (Android 7.0).

\newpage

# 6. Integrations

Cinder integrates with downstream systems in two directions:

- **Source integrations** pull events into Cinder from another system (e.g. Stripe, Intercom).
- **Destination integrations** push Cinder events or cohorts to another system (e.g. Slack, HubSpot).

## 6.1 Slack

The Slack integration delivers alerts to a channel when a saved query crosses a threshold. Configure under **Integrations → Slack**.

Common patterns:

- Alert when daily signups drop more than 30% week-over-week.
- Alert when funnel completion rate falls below a fixed threshold for two consecutive days.
- Daily digest of new high-value cohorts.

The integration uses Slack's incoming webhook API. Cinder does not request access to read or post outside the configured channel.

## 6.2 HubSpot

The HubSpot integration syncs Cinder cohort membership to HubSpot lists. New since v3.1 (2026-02-14). Each Cinder cohort can be mapped to a HubSpot static or dynamic list; membership is reconciled every 15 minutes.

The integration also supports reverse mapping: HubSpot list membership flows back into Cinder as a user trait, available for segmentation. Requires HubSpot Marketing Hub Professional or above.

## 6.3 Salesforce

The Salesforce integration exposes Cinder cohorts as Salesforce campaign members and writes a configurable subset of user traits to the Lead or Contact object. The sync is bidirectional: changes to the Salesforce Lead Owner field, for example, can be pulled back into Cinder as a user trait.

Available on the Scale plan only. Requires Salesforce Enterprise Edition or above.

## 6.4 Webhooks (Generic)

Beyond named integrations, any HTTPS endpoint can receive Cinder events via webhook (Section 4.5). Use this for systems Cinder does not natively integrate with.

## 6.5 Data Warehouse Sync

For customers who want events in their own warehouse, Cinder offers daily batch exports to Snowflake, BigQuery, and Redshift. Files arrive in a customer-owned staging bucket as gzipped JSONL, partitioned by date. Schema is the same as the API event model with two added fields: `_received_at` and `_workspace_id`.

Warehouse sync is included on Scale; Growth customers can purchase it as an add-on for $200/month per workspace.

\newpage

# 7. Billing & Plans

Cinder bills monthly, in arrears, based on the plan tier and the workspace's monthly tracked event volume (MTEV).

## 7.1 Plan Tiers

| Plan        | Base Price       | Included Events     | Overage             | Seats     |
| ----------- | ---------------- | ------------------- | ------------------- | --------- |
| **Starter** | $99 / month      | 100,000 / month     | $1.00 per 1,000     | 3 seats   |
| **Growth**  | $499 / month     | 5,000,000 / month   | $0.50 per 1,000     | 15 seats  |
| **Scale**   | Custom           | Custom              | Custom              | Unlimited |

Effective 2026-05-01, the Growth tier event cap was raised from 2,500,000 to 5,000,000 at the same base price. Customers on Growth as of that date were automatically migrated; no action was required.

The Scale plan is negotiated per contract and typically starts at $2,500/month for committed annual volumes. Scale customers receive a dedicated solutions engineer, priority support with a 4-hour response SLA, and access to the Salesforce integration.

## 7.2 Event Counting

Only events sent to the `production` environment count toward the MTEV. Events with environment `development` or `staging` are free and unlimited.

The following do **not** count as billable events:

- `cinder.identify()` calls (user trait updates).
- `cinder.page()` and `cinder.screen()` calls when `autoPageTracking` is enabled in the SDK. (Manually invoked page/screen calls do count.)
- Events rejected for schema violations.

A workspace exceeding its monthly cap is *not* throttled in real time. Overage charges appear on the next invoice with line-item detail.

## 7.3 Annual Commitments

Customers committing to an annual plan receive a 15% discount off the listed monthly price, paid upfront. Annual commitments lock in the per-event rate; if Cinder's published rates increase mid-contract, the customer's rate does not change until renewal.

## 7.4 Invoicing and Payment

Invoices are issued on the first business day of the month for the prior month's usage. Payment is due net-30 via credit card or ACH. Wire transfer is available for invoices above $5,000.

Late payments accrue 1.5% interest per month after the 30-day grace period. Workspaces 60+ days delinquent are downgraded to read-only mode until the balance clears.

## 7.5 Plan Changes

Upgrades are immediate and prorated to the day. Downgrades take effect at the next billing cycle to avoid retroactive overage charges. To downgrade, contact `billing@cinder.io` at least 7 days before your next invoice date.

\newpage

# 8. Security & Compliance

Cinder operates as a SaaS data processor under the contracts and standards described below.

## 8.1 Certifications

- **SOC 2 Type II** — current report dated 2025-08-19, covering the period 2024-08-01 through 2025-07-31. Available under NDA.
- **ISO 27001:2022** — certified 2025-03-12, valid through 2028-03-11.
- **GDPR** — Cinder operates as a data processor for customer data. A Data Processing Addendum (DPA) is available at `https://cinder.io/legal/dpa` and is automatically incorporated into all customer agreements.
- **HIPAA** — Cinder is not currently HIPAA-compliant. Customers must not send protected health information.

## 8.2 Infrastructure

Cinder runs on AWS in two regions: `us-east-1` (primary) and `eu-west-1`. EU customer data is routed to and stored in `eu-west-1` only; this routing is enforced at the API gateway based on the workspace region setting and cannot be disabled.

All data is encrypted at rest using AES-256 and in transit using TLS 1.2 or higher. Per-workspace encryption keys are managed in AWS KMS.

## 8.3 Access Controls

Internal access to customer data is restricted to a small on-call group and is logged in an immutable audit trail. Access requires a documented support ticket from the customer or a security incident; standing access is not granted.

Customers manage their own access via SSO (SAML 2.0) on the Growth plan and above. Role-based access control supports four roles: `owner`, `admin`, `editor`, `viewer`.

## 8.4 Data Retention and Deletion

Event data is retained for the lifetime of the workspace, subject to plan limits:

- **Starter**: 12 months of event history queryable.
- **Growth**: 24 months of event history queryable.
- **Scale**: Unlimited event history; data older than the contracted retention is moved to cold storage and queryable with a 24-hour restore SLA.

Customers can delete an individual user's data via `DELETE /v3/users/{user_id}` (GDPR Article 17 right to erasure). Deletion is propagated to backups within 30 days.

## 8.5 Incident Response

Cinder's security incident response process is summarized in the public runbook at `https://cinder.io/security/runbook`. Customer-affecting incidents are communicated within 72 hours of confirmation, per GDPR Article 33 requirements.

The most recent customer-facing incident report (2025-09-04, partial dashboard outage in `us-east-1`, 47 minutes) is available in the customer portal under **Settings → Incidents**.

## 8.6 Subprocessors

A current list of Cinder subprocessors is maintained at `https://cinder.io/legal/subprocessors`. Material changes are notified at least 30 days in advance. As of v3.2, subprocessors include AWS (infrastructure), Stripe (billing), Resend (transactional email), and Sentry (error reporting).

\newpage

# 9. Changelog

This changelog covers releases from v2.0 (2025-01-12) through v3.2 (2026-05-02). Patch releases are merged into the nearest minor release entry.

## v3.2 — 2026-05-02

- **New:** Cohort membership API (`GET /v3/cohorts/{id}/users`) for programmatic export.
- **Changed:** Growth tier monthly event cap raised from 2.5M to 5M at the same $499 base price.
- **Changed:** Default funnel window increased from 3 days to 7 days for new funnel reports. Existing funnels are unaffected.
- **Fixed:** Race condition in HubSpot list sync that occasionally double-counted membership transitions.
- **Deprecated:** Reminder — the v2 funnel endpoint (`/v2/funnel`) reaches end-of-life on 2026-12-31.

## v3.1 — 2026-02-14

- **New:** HubSpot integration (Section 6.2). Supports cohort-to-list sync and reverse trait sync.
- **New:** Mobile SDK retention reports. Previously web-only.
- **Changed:** Expanded property filter operators in `POST /v3/queries/funnel` to include `in`, `not_in`, `regex_match`.
- **Fixed:** Snapshot expiry was honoring the workspace's *current* plan rather than the plan at snapshot creation time.

## v3.0 — 2025-11-08

- **Major:** New v3 query engine. Most funnel and retention queries are 3–10x faster on cohorts above 100K users.
- **New:** SQL-compatible query interface (beta) for Growth and Scale customers.
- **New:** Snapshots (Section 3.5).
- **Deprecated:** v2 funnel endpoint deprecated, sunset planned for 2026-12-31.
- **Removed:** Legacy CSV bulk-import. Customers should use the batch events endpoint (`POST /v3/events/batch`).

## v2.4 — 2025-08-19

- **Changed:** Refreshed SOC 2 Type II report; new certification window 2024-08-01 to 2025-07-31.
- **Changed:** Updated Data Processing Addendum to reflect the EU-US Data Privacy Framework.
- **New:** Per-property PII tagging in the schema browser.

## v2.3 — 2025-06-04

- **New:** Salesforce integration (Scale only, Section 6.3).
- **New:** Workspace-level audit log export.
- **Fixed:** UTC offset handling in retention queries when the workspace timezone was set to a non-UTC zone.

## v2.2 — 2025-04-15

- **New:** Daily warehouse export to Snowflake, BigQuery, Redshift.
- **Changed:** Starter tier event cap raised from 50K to 100K at the same $99 base price.

## v2.1 — 2025-03-03

- **New:** SAML 2.0 SSO on Growth and Scale.
- **New:** Public sharing with token-based access control.

## v2.0 — 2025-01-12

- **Initial release of the v2 platform.** Complete rewrite of the ingestion pipeline, new event schema, redesigned dashboard UI.

---

*End of document.*
