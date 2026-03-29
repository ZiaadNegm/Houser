# Product Requirements Document

## WoningNet DAK Auto-Apply App (MVP)

## 1. Status

**Status:** Final MVP PRD
**Purpose:** Source of truth for MVP scope and implementation direction
**Phase:** MVP
**Default schedule:** 12:00 and 00:00 Europe/Amsterdam, pending later validation against actual listing publication cadence

---

## 2. Product Summary

The product is a hosted web application that automatically checks WoningNet DAK listings on a fixed schedule, ranks the currently available opportunities using a lightweight scoring model, and automatically applies to the best opportunities for the user.

The MVP is intentionally narrow. It focuses on making the core loop work reliably:

1. Fetch current listings.
2. Determine the best opportunities based on a simple ranking rule.
3. Apply automatically.
4. Optionally revoke a weaker current application if a better one appears.
5. Show the user what happened in a simple web interface.

The system is designed to remain as stateless as reasonably possible by using WoningNet as the operational source of truth for current application status.

---

## 3. Problem Summary

The user does not reliably check WoningNet DAK manually and therefore misses opportunities to respond to listings in time.

Because only a limited number of active responses can be held at once, the product must not only automate applying, but also make simple replacement decisions when a better opportunity appears.

---

## 4. Goal

The goal of the MVP is to reduce missed housing opportunities by automatically checking WoningNet DAK, selecting the listings with the best current provisional positions, and managing the user's active application slots with minimal manual effort.

The goal is **not** to build a perfect recommendation engine in the MVP. The goal is to build a reliable hosted automation skeleton that can later be extended with richer scoring, user preferences, and stronger controls.

---

## 5. MVP Capabilities

The MVP must provide the following capabilities:

* A hosted backend that runs independently of the user's machine
* Fixed automated checks at **12:00** and **00:00** Europe/Amsterdam
* Listing retrieval from WoningNet DAK
* Lightweight scoring based on the best current **provisional position**
* Automatic application to the best opportunities
* Simple automatic revoke-and-replace behavior
* App login
* A simple web interface to inspect runs, actions, and current status
* Blacklist support for listings the system must never apply to
* Minimal persistence for users, secrets, logs, blacklist entries, and basic settings
* Basic observability through job logs, action logs, and simple metrics
* Idempotent execution behavior

This section defines the full **core MVP scope**.

---

## 6. MVP Decision Policy

The MVP decision policy is intentionally simple.

### 6.1 Scoring Rule

Listings are ranked primarily by **best provisional position**, where a lower position number is better.

The MVP scoring system should be implemented as a simple skeleton so that richer scoring can be added later.

### 6.2 Apply Rule

* If fewer than 2 active slots are occupied, the system may apply to the best valid candidate.
* If 2 active slots are already occupied, the system compares the best newly found candidate with the weakest currently held application.
* In the MVP, “better” means **better provisional position only**.

### 6.3 Revoke-and-Replace Rule

* The system may revoke the weakest currently held application only if the new candidate has a better provisional position.
* The system must only attempt the new application **after** the revoke is confirmed.
* If confirmation is unavailable or unclear, the system must not continue blindly.

### 6.4 Exclusions

The system must not act on a listing that is blacklisted.

---

## 7. Functional Requirements

### 7.1 App Authentication

* The app must support login for the app user.
* The app must maintain access control for the frontend.
* App authentication must remain separate from WoningNet session and authentication handling.

### 7.2 WoningNet Access

* The system must be able to act on behalf of the user against WoningNet.
* The system must securely store the minimum credentials, secrets, cookies, or session material needed for this.
* WoningNet access and session details may be revised during implementation after investigation.

### 7.3 Scheduled Execution

* The system must run automatically on a fixed schedule.
* The MVP default schedule is **12:00** and **00:00** Europe/Amsterdam.
* This schedule is a temporary MVP default and may later be adjusted once listing publication timing is better understood.
* The system must prevent overlapping runs for the same user.

### 7.4 Listing Retrieval

* The system must retrieve the currently available listings needed for scoring and action-taking.
* The system must extract the minimum fields required for the MVP decision policy.
* The system should rely on current remote state instead of maintaining a large local listing history.

### 7.5 Scoring

* The system must assign a simple score or ranking to candidate listings.
* The MVP scoring must prioritize best provisional position.
* The scoring logic must be implemented in a way that can be extended later.

### 7.6 Apply Action

* The system must be able to apply automatically to a selected listing.
* Before applying, the system must check the current remote state where possible.
* The system must avoid duplicate apply attempts.
* The system must log each apply attempt and outcome.

### 7.7 Revoke Action

* The system must be able to revoke an existing active application in the MVP.
* The system must only revoke according to the MVP replacement rule.
* The system must verify the outcome before proceeding to the replacement apply.
* The system must log each revoke attempt and outcome.

### 7.8 Frontend

The frontend must allow the user to:

* Sign in to the app
* Inspect recent runs
* Inspect recent actions
* Inspect current relevant housing and application state as observed from WoningNet
* Inspect basic metrics
* Inspect user-action-required situations
* Manage blacklist entries

### 7.9 Blacklist

* The user must be able to blacklist a listing by its identifier.
* Blacklisted listings must be excluded from automated actions.
* Blacklist entries must persist.

### 7.10 User-Action-Required States

For the MVP, the frontend must surface at minimum:

* Candidate is #1
* Documents are requested
* The WoningNet session is expired or invalid
* An automation run failed or an action failed

These states are frontend-visible only in the MVP. Notifications are not required.

### 7.11 Logging

The product must store at minimum:

* Timestamp
* User
* Job or run identifier
* Action type
* Listing identifier and/or link
* Outcome status
* Optional score value

A score breakdown is desirable if it is cheap to add, but it is not required for the MVP.

### 7.12 Metrics

The product must expose basic metrics such as:

* Runs started
* Runs completed
* Runs failed
* Apply attempts
* Apply successes
* Revoke attempts
* Revoke successes

---

## 8. State and Data Model

### 8.1 State Philosophy

The MVP should be as lightweight and stateless as practical.

WoningNet already exposes much of the important operational state, such as whether a listing has been responded to and whether a response is still active. The app should therefore avoid creating a large internal state machine unless it becomes necessary.

### 8.2 Minimal Data to Persist

The MVP should persist only the minimum required data:

* App users
* WoningNet-linked credentials, secrets, and session material as needed
* Blacklist entries
* Action logs
* Job and run logs
* Basic metrics
* Minimal product settings

### 8.3 What We Intentionally Do Not Model in the MVP

The MVP does not require a full internal lifecycle model for:

* Discovered, parsed, eligible, ineligible, or expired listing states
* Apply pending, revoke pending, or needs-human-review states
* Full historical snapshots of every listing change
* Advanced eligibility tracking logic inside the product

### 8.4 External-State-First Design

Where possible, the system should query WoningNet to determine the current actionable state rather than trusting stale internal assumptions.

---

## 9. Source of Truth

WoningNet is the operational source of truth for current listing and application state.

That means:

* The system should inspect current remote state before taking an action where possible.
* The system should verify the result after acting where possible.
* The system should not rely on complex local state to determine whether an action already happened.
* The system may keep lightweight logs and metadata locally, but these are supporting records rather than the primary truth of the current housing state.

---

## 10. Idempotency and Safety

The system must be designed around idempotent behavior.

### 10.1 Idempotency

* Re-running a job must not create duplicate applications.
* Re-running a job must not create duplicate revokes.
* The system must inspect current state before acting where possible.

### 10.2 Safety Rules

* Revoke-and-replace must happen in the correct order: revoke first, then apply.
* The system must not continue with a replacement apply if the revoke could not be confirmed.
* The system must avoid acting on blacklisted listings.
* The system must avoid overlapping runs for the same user.

### 10.3 Validation Approach

Core automation rules and guardrails should be covered with tests.

---

## 11. Observability

The MVP must provide basic observability sufficient to understand what the system did and whether it worked.

### 11.1 Required Visibility

* Run history
* Action history
* Failure visibility
* Basic counts and success/failure metrics

### 11.2 Goal

Observability in the MVP is intended to support product trust and debugging, not enterprise-grade monitoring.

---

## 12. Security and Secrets

The MVP must securely handle the minimum sensitive data needed to operate.

### 12.1 Sensitive Data

The main sensitive data in the MVP is:

* User credentials and/or session material needed for WoningNet access
* App authentication credentials

### 12.2 Requirements

* Sensitive data must be stored securely.
* Sensitive data must not appear in logs.
* Access to sensitive data must be limited to what the product needs to function.
* The security model may remain minimal in the MVP, but it must not treat credentials casually.

---

## 13. Non-Functional Requirements

### 13.1 Reliability

* The product must run independently of the user's machine.
* Scheduled runs should be reliable enough for daily use.

### 13.2 Simplicity

* The MVP should favor a simple architecture and understandable rules over elaborate workflow systems.

### 13.3 Maintainability

* The scoring system must be easy to extend later.
* The automation logic should remain modular enough to refine replacement rules and preferences later.

### 13.4 Performance

* Performance only needs to be sufficient for scheduled checks and a simple dashboard.
* Extreme optimization is not required for the MVP.

### 13.5 Testability

* Core decision and safety rules should be testable in isolation.

### 13.6 Operability

* Basic logs and metrics must be sufficient to debug failed runs and failed actions.

---

## 14. Phase 2 / Out of Scope for the MVP

The following items are intentionally out of scope for the MVP and belong to Phase 2 or later:

* Multi-user support with strong tenant isolation
* Richer preference storage and user-configurable scoring weights
* Hard filters versus soft preferences
* Minimum score thresholds
* Richer score explanations and breakdowns
* Advanced manual review workflows
* Push notifications or native notifications
* Email or event parsing beyond basic frontend surfacing
* Deeper internal lifecycle and state modeling
* Richer analytics and reporting
* More advanced observability and alerting
* Stronger operator and admin tooling

---

## 15. Assumptions and Constraints

### 15.1 Assumptions

* WoningNet exposes enough visible state for the app to stay mostly lightweight and externally reconciled.
* Provisional position is a sufficient ranking signal for the MVP.
* The user is willing to check the web app periodically rather than relying on notifications.

### 15.2 Constraints

* The product should remain narrow and MVP-focused.
* Persistence should remain minimal.
* Schedule timing is a temporary default until publication cadence is better understood.

---

## 16. Risks

* WoningNet authentication and session handling may be more complex than expected.
* Provisional position alone may lead to suboptimal replacement decisions.
* Important action-required states may be missed if the user does not check the frontend often enough.
* Listing publication timing may later justify a different schedule.

---

## 17. Success Criteria

The MVP is successful if:

* It runs independently of the user's machine.
* It executes reliably on the default schedule.
* It applies to the currently best opportunities according to the MVP rule.
* It revokes and replaces safely according to the MVP rule.
* It exposes enough visibility in the frontend for the user to understand what happened.
* It remains simple enough to iterate on quickly in later phases.

---

## 18. Supporting Product Logic Included in This PRD

Beyond the core sections requested, this PRD also includes:

* An explicit MVP decision policy
* Assumptions and constraints
* Risks
* Success criteria

These sections are included because they make the document operationally useful as a real source of truth rather than just a feature list.

