# Tech Stack & Hosting Decision Document

## WoningNet DAK Auto-Apply App (MVP)

## 1. Purpose

This document defines the core technical choices for the MVP and explains the reasoning behind the most important architectural decisions.

It complements the Product Requirements Document, which defines **what** the product should do. This document focuses on **how** we implement and host it.

---

## 2. Core Architecture Choice — Supabase-Centric Stack

The MVP is built around a **Supabase-centric architecture**.

### Why Supabase

Supabase allows us to consolidate multiple critical components into a single platform:

* **Database (Postgres)**
* **Authentication**
* **Cron scheduling**
* **Serverless execution (Edge Functions)**

This provides:

* very fast setup
* minimal infrastructure overhead
* strong integration between components
* a clean developer experience

Most importantly, it allows us to **run the entire automation pipeline inside one ecosystem**, which reduces complexity significantly for an MVP.

---

## 3. Scheduler Choice — Supabase Cron

### Why Supabase Cron

* It supports standard cron-based scheduling.
* It is **free**, which makes it ideal for an MVP.
* It integrates directly with Supabase Edge Functions.
* It matches the product perfectly, since the system runs on fixed daily schedules.

### What it is used for

* Triggering automation runs at fixed times (12:00 and 00:00 Europe/Amsterdam).

This avoids introducing any external scheduler and keeps the system simple.

---

## 4. Automation Runner — Supabase Edge Functions

### Why Edge Functions

Edge Functions allow us to run serverless logic directly inside the Supabase ecosystem.

This is ideal because:

* execution is event/cron-driven
* no always-on server is required
* it integrates directly with the database and scheduler

### Initial concerns

Before validating the approach, there were two main risks:

1. **CPU/runtime constraints**

   * Edge Functions may not be suitable for heavier workloads.

2. **Need for browser automation (Playwright)**

   * If WoningNet required JavaScript execution or browser interaction, Edge Functions would likely not be sufficient.

### Validation

We explicitly tested the integration (see report) and found:

* The system works via **pure HTTP requests**.
* No browser automation is required.
* The full flow (login → fetch → parse → act) executes successfully inside Edge Functions.
* Measured CPU time is approximately **0.14 seconds**, well within safe limits.

### Conclusion

Based on this validation:

* Supabase Edge Functions are **fully viable** for the MVP.
* The earlier concerns (CPU limits and Playwright requirement) are no longer blockers.

This confirms that Edge Functions are the correct execution environment.

---

## 5. WoningNet Integration Model

### Key finding

The WoningNet system can be integrated via **direct HTTP interaction**, not browser automation.

### Important characteristics

* Cookie-based session authentication
* CSRF protection with rotating tokens
* Global and per-endpoint version tokens

### Implication for the system

Each run must:

1. Initialize session (anonymous cookies + CSRF)
2. Perform login
3. Extract new authenticated cookies and rotated CSRF token
4. Use those for all subsequent requests
5. Include correct version tokens
6. Refresh versions when required

This is a **stateless-per-run model**, which fits serverless execution very well.

---

## 6. Database & Auth (Supabase)

Supabase is used for both:

* **Postgres (data storage)**
* **Authentication**

### Why

* Simple setup
* Native integration with the rest of the stack
* Sufficient for MVP needs

### What is stored

* Users
* Logs (runs and actions)
* Blacklist entries
* Minimal settings and feature flags

---

## 7. Observability and Logging

We log the minimum required to understand and debug the system:

* run start/end
* actions taken (apply/revoke)
* outcomes
* basic error classification

This is sufficient for MVP visibility and debugging.

---

## 8. Architecture Principle

Even within a simple MVP, the system should be modular.

Key logical components:

* session/auth handling
* CSRF + cookie handling
* version handling
* listing retrieval
* scoring
* action execution (apply/revoke)
* orchestration

This keeps the system understandable and extensible.

---

## 9. Final Conclusion

The core architectural decision is to use a **Supabase-centric, serverless architecture**.

This is justified because:

* all required functionality (DB, auth, cron, execution) is available in one platform
* the integration is lightweight (pure HTTP)
* runtime constraints are well within limits
* no browser automation is required

This makes the chosen stack both **simple and technically sound** for the MVP.

---

## 10. Next Step

With the product requirements and tech stack now defined, the next step is to design:

* how the system components interact
* the internal architecture
* the control flow of a full automation run
* the data model behind the system

