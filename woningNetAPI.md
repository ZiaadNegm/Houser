# WoningNet DAK API — Complete Research Report

## Context

This report consolidates all findings from the WoningNet API spike. It documents every discovered endpoint, how authentication works, what data is available, performance measurements, and the final verdict on Supabase Edge Function viability. This is the authoritative reference for implementing the automation system described in `productRequirements.md` and `techStack.md`.

---

## 1. Platform Overview

| Property | Value |
|----------|-------|
| Site | `almere.mijndak.nl` (DAK — the new WoningNet frontend) |
| Framework | OutSystems Reactive Web (low-code SPA) |
| Auth model | Cookie-based sessions (no OAuth/JWT/Bearer) |
| API pattern | JSON POST to `https://{region}.mijndak.nl/screenservices/{Module}/{Screen}/{Action}` |
| Region ID | `SamenwerkingsverbandId: "7"` (Almere), `SamenwerkingsverbandCode: "ALM"` |
| CSRF protection | Rotating `X-CSRFToken` header, extracted from `nr2Users` cookie |

### URL Structure

All API endpoints follow the OutSystems convention:
```
/screenservices/{AppModule}/{ScreenFolder}/{ScreenName}/{ActionName}
```

Example: `/screenservices/DAKWP/HuisDetails/InHetKortEnPositie/ActionVerwerkReactie`

### How the API was Discovered

The WoningNet site is a single-page application (SPA) built on OutSystems. There is no public API documentation. All endpoints were discovered by:

1. Opening the site in a headless browser (Playwright/Chromium)
2. Injecting an XHR interceptor that records all `XMLHttpRequest` calls
3. Performing actions (login, browse listings, apply, revoke) and capturing the requests
4. Extracting `apiVersion` hashes from the OutSystems JavaScript bundle files (`*.mvc.js`)
5. Replaying captured requests via `curl` to verify they work outside the browser

This confirms that **no browser automation is needed** — all operations are simple JSON POSTs.

---

## 2. Authentication Flow

### Overview

WoningNet uses a **cookie-based session** with **CSRF protection**. There are no Bearer tokens, no OAuth, and no CAPTCHAs.

Two cookies handle everything:
- **`nr1Users`** (HttpOnly, encrypted) — your identity. The server encrypts it; JavaScript cannot read it.
- **`nr2Users`** (readable by JavaScript) — contains the CSRF token + user metadata: `crf=<TOKEN>;uid=<USER_ID>;unm=<EMAIL>`

### Step 1 — Get anonymous cookies + CSRF token

Send an empty POST to the login endpoint. This returns anonymous cookies (not logged in, but you now have a CSRF token).

```http
POST /screenservices/DAKWP/Onboarding/Home/ActionLoginServer
Content-Type: application/json; charset=UTF-8
Accept: application/json

{}
```

Response sets two `Set-Cookie` headers:
- `nr1Users` = `lid=Anonymous;tuu=0;exp=0;rhs=...;hmc=...`
- `nr2Users` = `crf=T6C+9iB49TLra4jEsMeSckDMNhQ=;uid=0;unm=`

To extract the CSRF token:
1. URL-decode the `nr2Users` cookie value
2. Split by `;` into key=value pairs
3. Read the `crf` value

Example (Python):
```python
import urllib.parse
nr2 = urllib.parse.unquote(cookie_value)
crf = dict(x.split('=', 1) for x in nr2.split(';'))['crf']
```

### Step 2 — Login with credentials

```http
POST /screenservices/DAKWP/Onboarding/Home/ActionLoginServer
Content-Type: application/json; charset=UTF-8
Accept: application/json
X-CSRFToken: <anonymous_csrf_from_step_1>
OutSystems-locale: nl-NL
Cookie: nr1Users=...; nr2Users=...

{
  "versionInfo": {
    "moduleVersion": "<current_module_version>",
    "apiVersion": "VaTA0J2xvZd_AfHiRpFaJA"
  },
  "viewName": "Onboarding.Home",
  "inputParameters": {
    "Gebruikersnaam": "<email>",
    "Wachtwoord": "<password>",
    "SwvClient": "7",
    "IsVanContactformulier": false,
    "ReturnUrl": "",
    "WoningAanbodPublicatie": "",
    "IsKlantContactCode": false,
    "ClientInputLastUrl": "",
    "IsIngelogdBlijven": false,
    "RequestId_In": "0",
    "Request_In": ""
  }
}
```

**Success response (HTTP 200):**
```json
{
  "data": {
    "IsNaarWoningOverzicht": true,
    "SWVConfiguratie": { "HeeftSlaagkans": true, "HogeKans": 60, "RedelijkeKans": 20 },
    "NatuurlijkPersoonId": "0",
    "ClientVoorkeurenLaatsteLogin": "2026-03-29T13:59:17Z"
  },
  "rolesInfo": "..."
}
```

**CRITICAL: The CSRF token rotates after login.** New `Set-Cookie` headers are returned:
- `nr1Users` — new encrypted authenticated session
- `nr2Users` — `crf=<NEW_CSRF>;uid=1590177;unm=ipayinq123@gmail.com`

All subsequent API calls must use the **new** `crf` value extracted from the updated `nr2Users` cookie.

### Session Properties

| Property | Value |
|----------|-------|
| Lifetime | ~15 minutes |
| Keep-alive option | Set `IsIngelogdBlijven: true` in login request |
| Required headers (all calls) | `Content-Type: application/json`, `Accept: application/json`, `X-CSRFToken: <token>`, `OutSystems-locale: nl-NL` |
| Cookie forwarding | Both `nr1Users` and `nr2Users` must be sent with every request |

### Authentication Gotchas

| Issue | Solution |
|-------|----------|
| `versionInfo` must be correct, not empty strings | Use current `moduleVersion` and endpoint-specific `apiVersion` |
| Parameters must be under `inputParameters` key | Don't put them at the top level of the JSON |
| `viewName` is required | Use the correct `{ScreenFolder}.{ScreenName}` for each endpoint |
| Empty `versionInfo` returns `data: {}` silently | Always set both version fields — silent failure, no error |
| Stale CSRF token | Re-extract from `nr2Users` after every request that sets new cookies |

---

## 3. Complete Endpoint Catalog

### 3.1 Core Automation Endpoints (verified via curl)

These are the endpoints required for the MVP automation loop. All have been tested end-to-end with real HTTP requests.

#### Fetch Listings — `DataActionHaalPassendAanbod`

```
POST /screenservices/DAKWP/Overzicht/WoningOverzicht/DataActionHaalPassendAanbod
apiVersion: m5qUyl5Y2usuDISldjtx_A
viewName: Overzicht.WoningOverzicht
```

**Request body:** ~20KB JSON including `screenData` with empty filter structures + `clientVariables`. The full template is included in Appendix A below. Most fields are empty filter structures that can be hardcoded as-is. The key variable field is `clientVariables.SamenwerkingsverbandId` (set to `"7"` for Almere).

**Response structure:**
```json
{
  "data": {
    "PublicatieLijst": {
      "List": [
        {
          "Id": "352391",
          "Adres": {
            "Straatnaam": "Schoolwerf",
            "Huisnummer": 48,
            "Huisletter": "",
            "HuisnummerToevoeging": "",
            "Postcode": "1354JE",
            "Woonplaats": "Almere",
            "Wijk": "De Werven (Almere Haven)",
            "PublicatieId": "352391"
          },
          "EinddatumTijd": "2026-03-31T05:00:00Z",
          "PublicatieDatum": "2026-03-24T00:00:00",
          "Matchpercentage": 100,
          "VoorlopigePositie": "479",
          "HeeftGereageerd": false,
          "IsIntrekkenReactieToegestaan": false,
          "EenheidSoort": "Woonruimte",
          "Eenheid": {
            "DetailSoort": "Etagewoning",
            "AantalKamers": 3,
            "TotaleOppervlakte": "75",
            "WoonVertrekkenTotOpp": "0",
            "Doelgroep": "Van Groot naar Beter",
            "NettoHuurBekend": true,
            "NettoHuur": "629.39",
            "BrutoHuurBekend": true,
            "Brutohuur": "764.36",
            "SubsidiabeleHuur": "0",
            "EnergieLabel": "C",
            "Eigenaar": "Ymere"
          },
          "ContractVorm": "Onbepaalde tijd",
          "Slaagkans": 80,
          "IsCluster": false,
          "IsBewaard": false,
          "IsVerborgen": false,
          "PublicatieLabel": "Van Groot naar Beter",
          "AantalReactiesOpPublicatie": "47",
          "Opleverdatum": "2026-05-01T00:00:00",
          "HeeftLift": false,
          "Verdieping": "2",
          "PublicatieModel": "aanbodmodel",
          "AanbiedingProcesSoort": ""
        }
      ]
    },
    "Result": { "IsSuccess": true, "ErrorMessage": "" },
    "InschrijvingId": "..."
  }
}
```

**Tested:** Returns 17 listings for Almere. Response is ~36KB.

#### Apply to Listing — `ActionVerwerkReactie`

```
POST /screenservices/DAKWP/HuisDetails/InHetKortEnPositie/ActionVerwerkReactie
apiVersion: 5BlewkyzW5nTekp_UvoFmQ
viewName: HuisDetails.HuisDetails
```

```json
{
  "versionInfo": {
    "moduleVersion": "<current>",
    "apiVersion": "5BlewkyzW5nTekp_UvoFmQ"
  },
  "viewName": "HuisDetails.HuisDetails",
  "inputParameters": {
    "ToonMijNietMeer": false,
    "PublicatieId": "<listing_id>",
    "SamenwerkingsverbandId": "7"
  }
}
```

**Response:**
```json
{
  "data": {
    "Result": {
      "IsSuccess": true,
      "ErrorMessage": "",
      "StatusCode": 0
    }
  }
}
```

Only 3 parameters needed: `PublicatieId` (from listings), `SamenwerkingsverbandId` ("7"), and `ToonMijNietMeer` (false).

#### Revoke Application — `ActionReactieIntrekken`

```
POST /screenservices/DAKWP/HuisDetails/InHetKortEnPositie/ActionReactieIntrekken
apiVersion: dx9CAFvt2dTHngeyZWxXeA
viewName: HuisDetails.HuisDetails
```

```json
{
  "versionInfo": {
    "moduleVersion": "<current>",
    "apiVersion": "dx9CAFvt2dTHngeyZWxXeA"
  },
  "viewName": "HuisDetails.HuisDetails",
  "inputParameters": {
    "PublicatieId": "<listing_id>",
    "SamenwerkingsverbandId": "7"
  }
}
```

Response: same `Result` structure as apply.

#### Confirm Application (additional step) — `ActionBevestigingReactieVerwerk`

```
POST /screenservices/DAKWP/HuisDetails/InHetKortEnPositie/ActionBevestigingReactieVerwerk
apiVersion: mht27_Dj5n+SQUADyspDAA
viewName: HuisDetails.HuisDetails
```

Discovered in the OutSystems MVC JS bundle. May be required for certain listing types that need confirmation after applying. Needs further testing with a real "Woningzoekende" account.

---

### 3.2 My Applications Endpoints (ReactieOverzicht)

These endpoints are critical for the PRD's requirement to check current application state before acting (sections 6.2, 6.3, 10.1).

**Note:** These are **role-gated** — they require the `Woningzoekende` (home-seeker) role. Our test account lacks this role, so responses return `NotRegisteredException: "Woningzoekende role required"`. They will work with a real registered user account.

| Action | URL | apiVersion | Purpose |
|--------|-----|------------|---------|
| `DataActionActueleReactiesHaal` | `.../Reacties/ReactieOverzicht/DataActionActueleReactiesHaal` | `GDlSSpx4yqrZQsUeW3Pdew` | **Current active applications** |
| `DataActionLopendeReactiesHaal` | `.../Reacties/ReactieOverzicht/DataActionLopendeReactiesHaal` | `UGiQzWvhYiUz3auyqSDHKw` | In-progress / pending applications |
| `DataActionHistorischeReactiesHaal` | `.../Reacties/ReactieOverzicht/DataActionHistorischeReactiesHaal` | `Z4jKgha5UoUGofSbQ7pbEA` | Historical (past) applications |
| `DataActionReactieOverzichtHaal` | `.../Reacties/ReactieOverzicht/DataActionReactieOverzichtHaal` | `HF2maKmu+P8fI1wZklg0dQ` | Overview of all applications |
| `DataActionReactieStappenHaal` | `.../Reacties/ReactieOverzicht/DataActionReactieStappenHaal` | `8eqqU9BRzYzWBjZffOBDeQ` | **Application process steps/status** |
| `DataActionSynchroniseerOpenstaandeAanbieding` | `.../Reacties/ReactieOverzicht/DataActionSynchroniseerOpenstaandeAanbieding` | `KmNcTPZS4dWVx4ZnI0tgGQ` | Sync pending offers |
| `ActionReactieIntrekken` | `.../Reacties/ReactieOverzicht/ActionReactieIntrekken` | `dx9CAFvt2dTHngeyZWxXeA` | Revoke from within "My Applications" |
| `ActionReactieOpAanbiedingVerwerk` | `.../Reacties/ReactieOverzicht/ActionReactieOpAanbiedingVerwerk` | `0MET9JKenO1frf4Zl4sJrA` | Accept/respond to an offer |

All use `viewName: "Reacties.ReactieOverzicht"`.

**Key insight for the product:**
- `DataActionActueleReactiesHaal` — check "how many active slots are occupied" before deciding to apply or revoke-and-replace
- `DataActionReactieStappenHaal` — detect which step in the process each application is at (useful for "#1 position" and "documents requested" states from PRD section 7.10)
- `ActionReactieOpAanbiedingVerwerk` — relevant when candidate is #1 and receives an offer

---

### 3.3 Listing Detail Endpoints (HuisDetails)

These provide detailed listing information and application state for a specific listing.

| Action | URL | apiVersion | Purpose |
|--------|-----|------------|---------|
| `DataActionGetPublicatieDetails` | `.../HuisDetails/HuisDetails_WB/DataActionGetPublicatieDetails` | `+97OLEczQGGczV97ite8Ng` | Full listing details |
| `DataActionGetInformatieReactie` | `.../HuisDetails/HuisDetails/DataActionGetInformatieReactie` | `68z+LBR2ulrfhBQw1uxUxQ` | Application state for this listing |
| `DataActionGetInformatieBijInschrijving` | `.../HuisDetails/HuisDetails/DataActionGetInformatieBijInschrijving` | `vvuQG5IDzwLgl1iyBaZ6Mw` | Registration info for this listing |
| `DataActionGetIsInschrijvingEnVestiging` | `.../HuisDetails/HuisDetails/DataActionGetIsInschrijvingEnVestiging` | `ex9VEin1CrAT32FoWNIF8w` | Check if registered + location check |
| `DataActionGetWoonlasten` | `.../HuisDetails/HuisDetails_WB/DataActionGetWoonlasten` | `ZDMzpaGd3WnYIB8YTZHotQ` | Housing costs breakdown |
| `DataActionGetEindDatumTijd` | `.../HuisDetails/HuisBelangrijksteInformatie/DataActionGetEindDatumTijd` | (from page) | Application deadline |
| `ScreenDataSetGetPublicatie` | `.../HuisDetails/HuisDetails/ScreenDataSetGetPublicatie` | `aBJrjpbxrjfr77ExcPLIGQ` | Full publication data |
| `ScreenDataSetGetFotos` | `.../HuisDetails/HuisDetails/ScreenDataSetGetFotos` | `g3bYOTFVtXmwLAJxZchAmQ` | Listing photos |
| `ScreenDataSetGetDownloads` | `.../HuisDetails/HuisDetails_WB/ScreenDataSetGetDownloads` | `Zdmx1SgJRGWnhnPLWYIuxw` | Downloadable documents |

All use `viewName: "HuisDetails.HuisDetails"`.

**Note:** These endpoints require `screenData.variables` including `PublicatieId` and `SamenwerkingsverbandId`. Exact `screenData` shape needs to be captured from the browser for each.

---

### 3.4 Account & Status Endpoints

| Action | URL | apiVersion | Purpose |
|--------|-----|------------|---------|
| `DataActionCheckLoginAndStatus` | `.../Common/Menu/DataActionCheckLoginAndStatus` | (from page) | Check if logged in and account status |
| `DataActionHaalAccountStatusEnZichtbareVelden` | `.../Overzicht/WoningOverzicht/DataActionHaalAccountStatusEnZichtbareVelden` | `GlYzU2Q3BlSzzrsQFm4o5w` | Account status + visible fields |
| `DataActionHaalInschrijvingEnWizardVolledig` | `.../Overzicht/WoningOverzicht/DataActionHaalInschrijvingEnWizardVolledig` | `62anVEeVkEkLm2F+OYxdjQ` | Full registration/wizard status |
| `DataActionCheckProfielPanelen` | `.../Overzicht/WoningOverzicht/DataActionCheckProfielPanelen` | `2Jzr8vBuZz0atwy1iAplKg` | Profile completeness check |
| `ScreenDataSetCheckInschrijvingActief` | `.../Common/Menu/ScreenDataSetCheckInschrijvingActief` | (from page) | Is registration active? |
| `ScreenDataSetGetInschrijvingenByUserId` | `.../Common/Menu/ScreenDataSetGetInschrijvingenByUserId` | (from page) | All registrations for user |

**Key for product:** `DataActionCheckLoginAndStatus` can verify session validity. `ScreenDataSetCheckInschrijvingActief` confirms the account is active (important for detecting "WoningNet session is expired/invalid" from PRD section 7.10).

---

### 3.5 Messages & Notifications Endpoints

| Action | URL | Purpose |
|--------|-----|---------|
| `ScreenDataSetBerichtenHaalMaandOngeopend` | `.../Common/Menu/ScreenDataSetBerichtenHaalMaandOngeopend` | Unread messages count |
| `ScreenDataSetGetNieuwsberichtenBySamenwerkingsverband` | `.../Common/Menu/ScreenDataSetGetNieuwsberichtenBySamenwerkingsverband` | News messages |
| `ScreenDataSetGetOngeopendeNieuwsberichtenBySamenwerkingsverband` | `.../Common/Menu/ScreenDataSetGetOngeopendeNieuwsberichtenBySamenwerkingsverband` | Unread news count |
| `ScreenDataSetGetProfielberichtenBySamenwerkingsverbandId` | `.../Common/Menu/ScreenDataSetGetProfielberichtenBySamenwerkingsverbandId` | Profile-related messages |

**Key for product:** Useful for detecting "documents requested" and other action-required states. Messages may contain notifications about position changes, document requests, or offers.

---

### 3.6 Other Discovered Endpoints

| Action | URL | Purpose |
|--------|-----|---------|
| `DataActionHaalNietPassendAanbodAantal` | `.../Overzicht/WoningOverzicht/DataActionHaalNietPassendAanbodAantal` | Count of non-matching listings |
| `DataActionHaalVerhuurdeWoningen` | `.../Service/Verhuurd/DataActionHaalVerhuurdeWoningen` | Recently rented properties |
| `DataActionVoorlopigePositieBeschikbaar` | `.../Overzicht/WoningOverzichtList/DataActionVoorlopigePositieBeschikbaar` | Check if provisional positions are available |
| `ActionMeerdereVoorlopigePositiesHaal` | `.../Overzicht/WoningOverzicht/ActionMeerdereVoorlopigePositiesHaal` | Fetch multiple positions at once |
| `DataActionHaalSitemeldingen` | `.../Common/Sitemelding_Popup/DataActionHaalSitemeldingen` | Site-wide announcements |
| `DataActionCheckOnderhoudStatus` | `.../Layouts/OnderhoudChecker/DataActionCheckOnderhoudStatus` | Site maintenance status |
| `DataActionSWVConfiguratiesHaal` | `DAKReusable_CW/HuisDetails_CW/Slaagkans/DataActionSWVConfiguratiesHaal` | Success chance configuration |
| `DataActionHaalVoorwaardenGeaccepteerd` | `.../Layouts/LayoutTopMenu_VoorwaardenCheck/DataActionHaalVoorwaardenGeaccepteerd` | Terms acceptance check |

---

## 4. Version Token System

### How it works

Every API call requires two version tokens in the request body:

```json
{
  "versionInfo": {
    "moduleVersion": "IWseWtH1_3xpgfEqlf4fxw",
    "apiVersion": "<per-endpoint-hash>"
  }
}
```

- **`moduleVersion`**: Global across all endpoints. Think of it as a build hash — changes when the entire site is redeployed.
- **`apiVersion`**: Per-endpoint. Changes when that specific endpoint's logic is updated. Each endpoint has its own unique hash.

### Checking the current moduleVersion

```
GET /moduleservices/moduleversioninfo
Response: { "versionToken": "IWseWtH1_3xpgfEqlf4fxw" }
```

This is a **public, unauthenticated** endpoint. No cookies or CSRF needed.

### Detecting stale versions

When a version is outdated, the API returns:
```json
{
  "versionInfo": { "hasModuleVersionChanged": true, "hasApiVersionChanged": false },
  "data": {}
}
```

Or `hasApiVersionChanged: true` if only the endpoint version changed. **The response is NOT an error** — it's HTTP 200 with empty `data`. You must check these flags.

### How apiVersions are stored

The `apiVersion` hashes are **embedded in OutSystems JavaScript bundle files** (`*.mvc.js`). They are NOT available via any REST API. They appear in the JS like:

```javascript
controller.callServerAction("VerwerkReactie", "screenservices/.../ActionVerwerkReactie", "5BlewkyzW5nTekp_UvoFmQ", ...)
controller.callDataAction("DataActionActueleReactiesHaal", "screenservices/.../DataActionActueleReactiesHaal", "GDlSSpx4yqrZQsUeW3Pdew", ...)
```

### Version recovery strategy

When `hasModuleVersionChanged: true` or `hasApiVersionChanged: true`:

1. Fetch the new `moduleVersion` from `GET /moduleservices/moduleversioninfo`
2. For `apiVersion` recovery:
   - **Option A (simple, recommended for MVP):** Store known versions in Supabase. When stale, alert + manual update.
   - **Option B (automated):** Fetch the MVC JS bundle for the relevant screen, parse out new `apiVersion` hashes with a regex. The bundle URLs include a cache-busting hash (`?V9xLR2nA961q3XNKCJFJuA`) which also changes on redeploy, so you'd need to load the page HTML first to discover the new URL.
   - **Option C (hybrid):** Start with Option A, build Option B later if frequent changes occur.

### Current apiVersion Registry (as of 2026-03-29)

| Endpoint | apiVersion |
|----------|------------|
| **Login** `ActionLoginServer` | `VaTA0J2xvZd_AfHiRpFaJA` |
| **Fetch listings** `DataActionHaalPassendAanbod` | `m5qUyl5Y2usuDISldjtx_A` |
| **Apply** `ActionVerwerkReactie` | `5BlewkyzW5nTekp_UvoFmQ` |
| **Revoke** `ActionReactieIntrekken` | `dx9CAFvt2dTHngeyZWxXeA` |
| **Confirm** `ActionBevestigingReactieVerwerk` | `mht27_Dj5n+SQUADyspDAA` |
| **Active applications** `DataActionActueleReactiesHaal` | `GDlSSpx4yqrZQsUeW3Pdew` |
| **Running applications** `DataActionLopendeReactiesHaal` | `UGiQzWvhYiUz3auyqSDHKw` |
| **Historical applications** `DataActionHistorischeReactiesHaal` | `Z4jKgha5UoUGofSbQ7pbEA` |
| **Application overview** `DataActionReactieOverzichtHaal` | `HF2maKmu+P8fI1wZklg0dQ` |
| **Application steps** `DataActionReactieStappenHaal` | `8eqqU9BRzYzWBjZffOBDeQ` |
| **Sync offers** `DataActionSynchroniseerOpenstaandeAanbieding` | `KmNcTPZS4dWVx4ZnI0tgGQ` |
| **Accept offer** `ActionReactieOpAanbiedingVerwerk` | `0MET9JKenO1frf4Zl4sJrA` |
| **Listing details** `DataActionGetPublicatieDetails` | `+97OLEczQGGczV97ite8Ng` |
| **Listing reaction info** `DataActionGetInformatieReactie` | `68z+LBR2ulrfhBQw1uxUxQ` |
| **Account status** `DataActionHaalAccountStatusEnZichtbareVelden` | `GlYzU2Q3BlSzzrsQFm4o5w` |
| **Registration status** `DataActionHaalInschrijvingEnWizardVolledig` | `62anVEeVkEkLm2F+OYxdjQ` |
| **Multiple positions** `ActionMeerdereVoorlopigePositiesHaal` | `te3S+9L9dnNGaAh8q6w1SQ` |
| Shared **moduleVersion** | `IWseWtH1_3xpgfEqlf4fxw` |

---

## 5. Key Listing Fields for Automation

| Field | Type | Purpose for MVP |
|-------|------|-----------------|
| `Id` | string | Unique listing ID — pass to apply/revoke |
| `Adres.Straatnaam` + `Huisnummer` + `Woonplaats` | string | Address for display/logging |
| `Adres.Wijk` | string | Neighborhood |
| `Adres.Postcode` | string | Postal code |
| `EinddatumTijd` | ISO 8601 | Application deadline — must not apply after this |
| `PublicatieDatum` | ISO 8601 | When listing was published |
| `Matchpercentage` | number 0-100 | Profile match score |
| `VoorlopigePositie` | string (number) | **Queue position — PRIMARY ranking signal for MVP** |
| `HeeftGereageerd` | boolean | Already applied? (idempotency check) |
| `IsIntrekkenReactieToegestaan` | boolean | Can this application be revoked? |
| `Slaagkans` | number | Success chance score (0-100) |
| `EenheidSoort` | string | "Woonruimte", "Parkeren", etc. |
| `Eenheid.AantalKamers` | number | Room count |
| `Eenheid.DetailSoort` | string | "Etagewoning", "Portiekwoning", etc. |
| `Eenheid.NettoHuur` | string (decimal) | Net rent |
| `Eenheid.Brutohuur` | string (decimal) | Gross rent |
| `Eenheid.Doelgroep` | string | Target group ("Jongeren", "Studenten", etc.) |
| `Eenheid.EnergieLabel` | string | Energy label (A-G) |
| `Eenheid.Eigenaar` | string | Housing corporation name |
| `ContractVorm` | string | "Onbepaalde tijd" (indefinite), etc. |
| `PublicatieModel` | string | "aanbodmodel" (standard), "lotingmodel" (lottery) |
| `AantalReactiesOpPublicatie` | string (number) | Total applicant count |
| `Opleverdatum` | ISO 8601 | Expected delivery/move-in date |
| `IsCluster` | boolean | Cluster listing (multiple units) |
| `IsBewaard` | boolean | Saved/favorited |
| `IsVerborgen` | boolean | Hidden by user |
| `HeeftLift` | boolean | Has elevator |
| `Verdieping` | string | Floor number |
| `PublicatieLabel` | string | Special label text (e.g. "Van Groot naar Beter") |
| `AanbiedingProcesSoort` | string | Offering process type |

---

## 6. Endpoint Mapping to PRD Requirements

| PRD Requirement | Endpoint(s) | Status |
|-----------------|-------------|--------|
| **Fetch listings** (7.4) | `DataActionHaalPassendAanbod` | Verified |
| **Apply** (7.6) | `ActionVerwerkReactie` | Verified |
| **Revoke** (7.7) | `ActionReactieIntrekken` | Verified |
| **Check current applications** (6.2, 6.3) | `DataActionActueleReactiesHaal` | Role-gated, needs real account |
| **Check application state** (10.1) | `DataActionReactieStappenHaal` | Role-gated, needs real account |
| **Already applied?** (idempotency 10.1) | `HeeftGereageerd` field in listings response | Available directly |
| **Can revoke?** (10.2) | `IsIntrekkenReactieToegestaan` field | Available directly |
| **Candidate is #1** (7.10) | `VoorlopigePositie` field + `DataActionReactieStappenHaal` | Position in listings, steps need real account |
| **Documents requested** (7.10) | `DataActionReactieStappenHaal` + messages endpoints | Needs real account to verify |
| **Session invalid** (7.10) | Login returns error or `DataActionCheckLoginAndStatus` | Testable |
| **Blacklist check** (7.9) | Local — compare `Id` against DB blacklist | No API needed |

---

## 7. Performance Measurements

### CPU Time (Supabase Edge Function 2-second limit)

Supabase Edge Functions count **CPU time** (synchronous JS execution) separately from **wall time** (which includes `await fetch()` network I/O). Network I/O does NOT count against the 2-second CPU limit.

| Operation | CPU Time | % of 2s limit |
|-----------|----------|---------------|
| JSON parse (36KB listings response) | 0.13ms | 0.007% |
| Score + filter 17 listings | 0.01ms | 0.0005% |
| Build request bodies (login + 5 applies) | ~0.01ms | ~0.0005% |
| **Total CPU per run** | **0.14ms** | **0.007%** |
| **Headroom remaining** | **1,999.86ms** | **99.993%** |

### Wall Time (network-dominated)

| Step | Wall Time |
|------|-----------|
| Get anonymous cookies | 226ms |
| Login | 370ms |
| Fetch listings | 763ms |
| Apply x1 | 351ms |
| Revoke x1 | 467ms |
| **Full flow (login + fetch + apply x5)** | **~3.1s** |

Well within the **150-second worker lifetime** (Supabase free tier).

### Stress Test Scenarios (extrapolated)

| Scenario | Listings | CPU Time | Verdict |
|----------|----------|----------|---------|
| Light (5 listings, ~10KB) | 5 | <0.1ms | trivial |
| Realistic (17 listings, 36KB) | 17 | 0.14ms | trivial |
| Worst-case (100 listings, ~200KB) | 100 | ~1ms | trivial |
| Extreme (1000 listings, ~2MB) | 1000 | ~10ms | still trivial |

**The CPU limit is a non-issue.** Even at 10,000x the current load, we'd use <1% of the budget.

---

## 8. Verdict: Supabase Edge Functions

**VIABLE.** All core operations work via pure HTTP. CPU usage is negligible. No browser automation needed.

| Question | Answer |
|----------|--------|
| HTTP or Playwright? | **HTTP** — all operations are JSON POSTs |
| Edge Functions viable? | **YES** — 0.007% CPU usage |
| CPU limit risk? | **NONE** — 14,000x headroom |
| Memory limit (256MB) risk? | **NONE** — largest response is 36KB |
| Browser automation needed? | **NO** |
| Login every run? | **YES** — session ~15min, login adds only 370ms |
| CAPTCHA or MFA present? | **NO** |
| Deno compatibility issues? | **NONE** — only uses `fetch()` + `JSON.parse()`, both built into Deno |

---

## 9. Known Limitations & Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Version tokens change on site redeploy | Medium | Detect `hasModuleVersionChanged`, refetch from `/moduleservices/moduleversioninfo`. For apiVersion: start with manual update, later automate via MVC JS parsing |
| ReactieOverzicht endpoints are role-gated | Medium | Must test with a real "Woningzoekende" account to verify response shapes and confirm we can check active application slots |
| Rate limiting / IP ban | Low | Add 200-500ms delays between operations |
| Session cookie format changes | Low | Cookie parsing is simple key=value |
| OutSystems API structure changes | Low | Monitor response shapes, alert on unexpected `data: {}` |
| `screenData` requirements vary per endpoint | Low | Some endpoints need full `screenData` with UI state. Capture and hardcode templates for each needed endpoint |
| Listings request body is ~20KB of boilerplate | Low | Hardcode template, only `clientVariables.SamenwerkingsverbandId` varies |

---

## 10. Open Questions (Need Real Account)

1. **ReactieOverzicht responses:** What do `ActueleReactiesHaal` and `LopendeReactiesHaal` actually return? We need the response shape to know how to count active application slots and detect position changes.

2. **Application confirmation flow:** Is `ActionBevestigingReactieVerwerk` always required after `ActionVerwerkReactie`, or only for certain listing types?

3. **Offer acceptance:** When you're #1 and get an offer, does `ActionReactieOpAanbiedingVerwerk` need to be called? This maps to the PRD's "Candidate is #1" action-required state.

4. **Document request detection:** How are "documents requested" states surfaced? Via `DataActionReactieStappenHaal` steps, or via the messages endpoints?

5. **Maximum concurrent applications:** Is the limit always 2 active slots? Is this visible in the API somewhere?

---

## 11. Complete Curl Workflow (Copy-Paste Ready)

```bash
#!/bin/bash
COOKIE_JAR="/tmp/woningnet-cookies.txt"
BASE="https://almere.mijndak.nl"

# --- STEP 1: GET ANONYMOUS COOKIES ---
curl -s -c "$COOKIE_JAR" -X POST "$BASE/screenservices/DAKWP/Onboarding/Home/ActionLoginServer" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{}' -o /dev/null

# --- STEP 2: EXTRACT CSRF TOKEN ---
CSRF=$(grep nr2Users "$COOKIE_JAR" | awk '{print $NF}' | \
  python3 -c "import sys,urllib.parse; v=urllib.parse.unquote(sys.stdin.read().strip()); print(dict(x.split('=',1) for x in v.split(';')).get('crf',''))")
echo "Anonymous CSRF: $CSRF"

# --- STEP 3: LOGIN ---
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST \
  "$BASE/screenservices/DAKWP/Onboarding/Home/ActionLoginServer" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -H "X-CSRFToken: $CSRF" -H "OutSystems-locale: nl-NL" \
  -d '{"versionInfo":{"moduleVersion":"IWseWtH1_3xpgfEqlf4fxw","apiVersion":"VaTA0J2xvZd_AfHiRpFaJA"},"viewName":"Onboarding.Home","inputParameters":{"Gebruikersnaam":"YOUR_EMAIL","Wachtwoord":"YOUR_PASSWORD","SwvClient":"7","IsVanContactformulier":false,"ReturnUrl":"","WoningAanbodPublicatie":"","IsKlantContactCode":false,"ClientInputLastUrl":"","IsIngelogdBlijven":false,"RequestId_In":"0","Request_In":""}}'

# --- STEP 4: GET NEW CSRF AFTER LOGIN (it rotated!) ---
CSRF=$(grep nr2Users "$COOKIE_JAR" | awk '{print $NF}' | \
  python3 -c "import sys,urllib.parse; v=urllib.parse.unquote(sys.stdin.read().strip()); print(dict(x.split('=',1) for x in v.split(';')).get('crf',''))")
echo "Authenticated CSRF: $CSRF"

# --- STEP 5: FETCH LISTINGS ---
# Note: requires the full ~20KB request body template (see Appendix A)
curl -s -b "$COOKIE_JAR" -X POST \
  "$BASE/screenservices/DAKWP/Overzicht/WoningOverzicht/DataActionHaalPassendAanbod" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -H "X-CSRFToken: $CSRF" -H "OutSystems-locale: nl-NL" \
  -d @listings-request-template.json

# --- STEP 6: APPLY TO A LISTING ---
curl -s -b "$COOKIE_JAR" -X POST \
  "$BASE/screenservices/DAKWP/HuisDetails/InHetKortEnPositie/ActionVerwerkReactie" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -H "X-CSRFToken: $CSRF" -H "OutSystems-locale: nl-NL" \
  -d '{"versionInfo":{"moduleVersion":"IWseWtH1_3xpgfEqlf4fxw","apiVersion":"5BlewkyzW5nTekp_UvoFmQ"},"viewName":"HuisDetails.HuisDetails","inputParameters":{"ToonMijNietMeer":false,"PublicatieId":"LISTING_ID_HERE","SamenwerkingsverbandId":"7"}}'

# --- STEP 7: REVOKE AN APPLICATION ---
curl -s -b "$COOKIE_JAR" -X POST \
  "$BASE/screenservices/DAKWP/HuisDetails/InHetKortEnPositie/ActionReactieIntrekken" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -H "X-CSRFToken: $CSRF" -H "OutSystems-locale: nl-NL" \
  -d '{"versionInfo":{"moduleVersion":"IWseWtH1_3xpgfEqlf4fxw","apiVersion":"dx9CAFvt2dTHngeyZWxXeA"},"viewName":"HuisDetails.HuisDetails","inputParameters":{"PublicatieId":"LISTING_ID_HERE","SamenwerkingsverbandId":"7"}}'
```

---

## 12. Next Steps

1. **Get a real Woningzoekende account** to test ReactieOverzicht endpoints and confirm response shapes
2. **Write the Edge Function** — session module (login + CSRF), listings module, scoring module, action module (apply/revoke)
3. **Start with dry-run mode** — log "would apply to X" / "would revoke Y" without taking action
4. **Add Supabase DB** — store run logs, action logs, blacklist
5. **Build frontend** — run viewer, current state, blacklist management

---

## Appendix A: Listings Request Body Template

This is the full ~20KB request body required for `DataActionHaalPassendAanbod`. Most fields are empty filter structures with type definitions that OutSystems requires. The key variable is `clientVariables.SamenwerkingsverbandId` (set to `"7"` for Almere).

Save this as `listings-request-template.json` and use with `curl -d @listings-request-template.json`.

```json
{"versionInfo":{"moduleVersion":"IWseWtH1_3xpgfEqlf4fxw","apiVersion":"m5qUyl5Y2usuDISldjtx_A"},"viewName":"Overzicht.WoningOverzicht","screenData":{"variables":{"ActiefTabblad":0,"Platform":"","PlatformVersie":"","ShowPopup":false,"IncompleteProfielOnderdelen":{"List":[],"EmptyListItem":{"ProfielPanelenId":0,"WeerTeGevenNaam":"","WRBNaam":"","WRBOmschrijving":"","IsCompleet":false,"BinnenkortBeschikbaar":false}},"LegeLijst":{"List":[],"EmptyListItem":{"ProfielPanelenId":0,"WeerTeGevenNaam":"","WRBNaam":"","WRBOmschrijving":"","IsCompleet":false,"BinnenkortBeschikbaar":false}},"AantalVerborgenWoningen":0,"AdvertentielijstContainerId":"","MapandFiltersContainerId":"","Filters":{"Woonplaatsen":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Eigenaren":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"TypeWoning":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"AantalKamers":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Aanbodmodel":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Doelgroep":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Voorzieningen":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Contractvormen":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Toegankelijkheid":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"OnzichtbareFilters":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"MaxPrijs":0,"MinPrijs":0,"Sortering":0,"SorteringIsAscending":false},"Filters_Basis":{"Woonplaatsen":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Eigenaren":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"TypeWoning":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"AantalKamers":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Aanbodmodel":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Doelgroep":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Voorzieningen":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Contractvormen":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"Toegankelijkheid":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"OnzichtbareFilters":{"List":[],"EmptyListItem":{"Naam":"","IsGeselecteerd":false,"Id":"0","Categorie":"","Aantal":0,"IsVisible":true,"IsEmptyValue":false}},"MaxPrijs":0,"MinPrijs":0,"Sortering":0,"SorteringIsAscending":false},"Filters_ChipList":{"List":[],"EmptyListItem":{"Categorie":"","Label":"","IsGroen":false}},"FilterMenu_Trigger":true,"PublicatieLijst_Basis":{"List":[],"EmptyListItem":{"Id":"0","EinddatumTijd":"1900-01-01T00:00:00","PublicatieModel":"","PublicatieModule":"","PublicatieDatum":"1900-01-01T00:00:00","Matchpercentage":0,"VoorlopigePositie":"0","Foto_Locatie":"","GepersonaliseerdeHuur":"0","Slaagkans":0,"IsCluster":false,"EenheidSoort":"","Adres":{"Straatnaam":"","Huisnummer":0,"Huisletter":"","HuisnummerToevoeging":"","Postcode":"","Woonplaats":"","Wijk":"","PublicatieId":"0"},"Cluster":{"Naam":"","DetailSoort":"","Doelgroep":"","PrijsMinBekend":false,"PrijsMin":"0","PrijsMaxBekend":false,"PrijsMax":"0","WoonOppervlakteMinBekend":false,"WoonVertrekkenTotOppMin":0,"WoonOppervlakteMaxBekend":false,"WoonVertrekkenTotOppMax":0,"AantalEenheden":0,"AantalKamersMin":0,"AantalKamersMax":0,"Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","Eigenaar":""},"Eenheid":{"DetailSoort":"","Bestemming":"","AantalKamers":0,"TotaleOppervlakte":"0","WoonVertrekkenTotOpp":"0","Doelgroep":"","NettoHuurBekend":false,"NettoHuur":"0","Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","EnergieLabel":"","EnergieIndex":0,"Eigenaar":"","BrutoHuurBekend":false,"Brutohuur":"0","SubsidiabeleHuur":"0"},"PublicatieLabel":"","IsBewaard":false,"IsVerborgen":false,"ContractVorm":"","PublicatieOmschrijving":{"Id":"0","Tekst":null},"AantalReactiesOpPublicatie":"0","HeeftGereageerd":false,"IsIntrekkenReactieToegestaan":false,"RedenNietIntrekkenReactie":"","PositieAanbiedingsproces":"","VirtuelePositie":0,"Opleverdatum":"1900-01-01T00:00:00","HeeftLift":false,"Verdieping":"","IsMetGepersonaliseerdeHuur":false,"Voorziening":"","AanbiedingProcesSoort":"","AantalEenhedenBeschikbaar":0}},"PublicatieLijst_Gefilterd":{"List":[],"EmptyListItem":{"Id":"0","EinddatumTijd":"1900-01-01T00:00:00","PublicatieModel":"","PublicatieModule":"","PublicatieDatum":"1900-01-01T00:00:00","Matchpercentage":0,"VoorlopigePositie":"0","Foto_Locatie":"","GepersonaliseerdeHuur":"0","Slaagkans":0,"IsCluster":false,"EenheidSoort":"","Adres":{"Straatnaam":"","Huisnummer":0,"Huisletter":"","HuisnummerToevoeging":"","Postcode":"","Woonplaats":"","Wijk":"","PublicatieId":"0"},"Cluster":{"Naam":"","DetailSoort":"","Doelgroep":"","PrijsMinBekend":false,"PrijsMin":"0","PrijsMaxBekend":false,"PrijsMax":"0","WoonOppervlakteMinBekend":false,"WoonVertrekkenTotOppMin":0,"WoonOppervlakteMaxBekend":false,"WoonVertrekkenTotOppMax":0,"AantalEenheden":0,"AantalKamersMin":0,"AantalKamersMax":0,"Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","Eigenaar":""},"Eenheid":{"DetailSoort":"","Bestemming":"","AantalKamers":0,"TotaleOppervlakte":"0","WoonVertrekkenTotOpp":"0","Doelgroep":"","NettoHuurBekend":false,"NettoHuur":"0","Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","EnergieLabel":"","EnergieIndex":0,"Eigenaar":"","BrutoHuurBekend":false,"Brutohuur":"0","SubsidiabeleHuur":"0"},"PublicatieLabel":"","IsBewaard":false,"IsVerborgen":false,"ContractVorm":"","PublicatieOmschrijving":{"Id":"0","Tekst":null},"AantalReactiesOpPublicatie":"0","HeeftGereageerd":false,"IsIntrekkenReactieToegestaan":false,"RedenNietIntrekkenReactie":"","PositieAanbiedingsproces":"","VirtuelePositie":0,"Opleverdatum":"1900-01-01T00:00:00","HeeftLift":false,"Verdieping":"","IsMetGepersonaliseerdeHuur":false,"Voorziening":"","AanbiedingProcesSoort":"","AantalEenhedenBeschikbaar":0}},"PublicatieLijst_Aanbod":{"List":[],"EmptyListItem":{"Id":"0","EinddatumTijd":"1900-01-01T00:00:00","PublicatieModel":"","PublicatieModule":"","PublicatieDatum":"1900-01-01T00:00:00","Matchpercentage":0,"VoorlopigePositie":"0","Foto_Locatie":"","GepersonaliseerdeHuur":"0","Slaagkans":0,"IsCluster":false,"EenheidSoort":"","Adres":{"Straatnaam":"","Huisnummer":0,"Huisletter":"","HuisnummerToevoeging":"","Postcode":"","Woonplaats":"","Wijk":"","PublicatieId":"0"},"Cluster":{"Naam":"","DetailSoort":"","Doelgroep":"","PrijsMinBekend":false,"PrijsMin":"0","PrijsMaxBekend":false,"PrijsMax":"0","WoonOppervlakteMinBekend":false,"WoonVertrekkenTotOppMin":0,"WoonOppervlakteMaxBekend":false,"WoonVertrekkenTotOppMax":0,"AantalEenheden":0,"AantalKamersMin":0,"AantalKamersMax":0,"Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","Eigenaar":""},"Eenheid":{"DetailSoort":"","Bestemming":"","AantalKamers":0,"TotaleOppervlakte":"0","WoonVertrekkenTotOpp":"0","Doelgroep":"","NettoHuurBekend":false,"NettoHuur":"0","Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","EnergieLabel":"","EnergieIndex":0,"Eigenaar":"","BrutoHuurBekend":false,"Brutohuur":"0","SubsidiabeleHuur":"0"},"PublicatieLabel":"","IsBewaard":false,"IsVerborgen":false,"ContractVorm":"","PublicatieOmschrijving":{"Id":"0","Tekst":null},"AantalReactiesOpPublicatie":"0","HeeftGereageerd":false,"IsIntrekkenReactieToegestaan":false,"RedenNietIntrekkenReactie":"","PositieAanbiedingsproces":"","VirtuelePositie":0,"Opleverdatum":"1900-01-01T00:00:00","HeeftLift":false,"Verdieping":"","IsMetGepersonaliseerdeHuur":false,"Voorziening":"","AanbiedingProcesSoort":"","AantalEenhedenBeschikbaar":0}},"PublicatieLijst_MiddenHuur":{"List":[],"EmptyListItem":{"Id":"0","EinddatumTijd":"1900-01-01T00:00:00","PublicatieModel":"","PublicatieModule":"","PublicatieDatum":"1900-01-01T00:00:00","Matchpercentage":0,"VoorlopigePositie":"0","Foto_Locatie":"","GepersonaliseerdeHuur":"0","Slaagkans":0,"IsCluster":false,"EenheidSoort":"","Adres":{"Straatnaam":"","Huisnummer":0,"Huisletter":"","HuisnummerToevoeging":"","Postcode":"","Woonplaats":"","Wijk":"","PublicatieId":"0"},"Cluster":{"Naam":"","DetailSoort":"","Doelgroep":"","PrijsMinBekend":false,"PrijsMin":"0","PrijsMaxBekend":false,"PrijsMax":"0","WoonOppervlakteMinBekend":false,"WoonVertrekkenTotOppMin":0,"WoonOppervlakteMaxBekend":false,"WoonVertrekkenTotOppMax":0,"AantalEenheden":0,"AantalKamersMin":0,"AantalKamersMax":0,"Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","Eigenaar":""},"Eenheid":{"DetailSoort":"","Bestemming":"","AantalKamers":0,"TotaleOppervlakte":"0","WoonVertrekkenTotOpp":"0","Doelgroep":"","NettoHuurBekend":false,"NettoHuur":"0","Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","EnergieLabel":"","EnergieIndex":0,"Eigenaar":"","BrutoHuurBekend":false,"Brutohuur":"0","SubsidiabeleHuur":"0"},"PublicatieLabel":"","IsBewaard":false,"IsVerborgen":false,"ContractVorm":"","PublicatieOmschrijving":{"Id":"0","Tekst":null},"AantalReactiesOpPublicatie":"0","HeeftGereageerd":false,"IsIntrekkenReactieToegestaan":false,"RedenNietIntrekkenReactie":"","PositieAanbiedingsproces":"","VirtuelePositie":0,"Opleverdatum":"1900-01-01T00:00:00","HeeftLift":false,"Verdieping":"","IsMetGepersonaliseerdeHuur":false,"Voorziening":"","AanbiedingProcesSoort":"","AantalEenhedenBeschikbaar":0}},"PublicatieLijst_Loting":{"List":[],"EmptyListItem":{"Id":"0","EinddatumTijd":"1900-01-01T00:00:00","PublicatieModel":"","PublicatieModule":"","PublicatieDatum":"1900-01-01T00:00:00","Matchpercentage":0,"VoorlopigePositie":"0","Foto_Locatie":"","GepersonaliseerdeHuur":"0","Slaagkans":0,"IsCluster":false,"EenheidSoort":"","Adres":{"Straatnaam":"","Huisnummer":0,"Huisletter":"","HuisnummerToevoeging":"","Postcode":"","Woonplaats":"","Wijk":"","PublicatieId":"0"},"Cluster":{"Naam":"","DetailSoort":"","Doelgroep":"","PrijsMinBekend":false,"PrijsMin":"0","PrijsMaxBekend":false,"PrijsMax":"0","WoonOppervlakteMinBekend":false,"WoonVertrekkenTotOppMin":0,"WoonOppervlakteMaxBekend":false,"WoonVertrekkenTotOppMax":0,"AantalEenheden":0,"AantalKamersMin":0,"AantalKamersMax":0,"Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","Eigenaar":""},"Eenheid":{"DetailSoort":"","Bestemming":"","AantalKamers":0,"TotaleOppervlakte":"0","WoonVertrekkenTotOpp":"0","Doelgroep":"","NettoHuurBekend":false,"NettoHuur":"0","Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","EnergieLabel":"","EnergieIndex":0,"Eigenaar":"","BrutoHuurBekend":false,"Brutohuur":"0","SubsidiabeleHuur":"0"},"PublicatieLabel":"","IsBewaard":false,"IsVerborgen":false,"ContractVorm":"","PublicatieOmschrijving":{"Id":"0","Tekst":null},"AantalReactiesOpPublicatie":"0","HeeftGereageerd":false,"IsIntrekkenReactieToegestaan":false,"RedenNietIntrekkenReactie":"","PositieAanbiedingsproces":"","VirtuelePositie":0,"Opleverdatum":"1900-01-01T00:00:00","HeeftLift":false,"Verdieping":"","IsMetGepersonaliseerdeHuur":false,"Voorziening":"","AanbiedingProcesSoort":"","AantalEenhedenBeschikbaar":0}},"PublicatieLijst_VrijeSector":{"List":[],"EmptyListItem":{"Id":"0","EinddatumTijd":"1900-01-01T00:00:00","PublicatieModel":"","PublicatieModule":"","PublicatieDatum":"1900-01-01T00:00:00","Matchpercentage":0,"VoorlopigePositie":"0","Foto_Locatie":"","GepersonaliseerdeHuur":"0","Slaagkans":0,"IsCluster":false,"EenheidSoort":"","Adres":{"Straatnaam":"","Huisnummer":0,"Huisletter":"","HuisnummerToevoeging":"","Postcode":"","Woonplaats":"","Wijk":"","PublicatieId":"0"},"Cluster":{"Naam":"","DetailSoort":"","Doelgroep":"","PrijsMinBekend":false,"PrijsMin":"0","PrijsMaxBekend":false,"PrijsMax":"0","WoonOppervlakteMinBekend":false,"WoonVertrekkenTotOppMin":0,"WoonOppervlakteMaxBekend":false,"WoonVertrekkenTotOppMax":0,"AantalEenheden":0,"AantalKamersMin":0,"AantalKamersMax":0,"Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","Eigenaar":""},"Eenheid":{"DetailSoort":"","Bestemming":"","AantalKamers":0,"TotaleOppervlakte":"0","WoonVertrekkenTotOpp":"0","Doelgroep":"","NettoHuurBekend":false,"NettoHuur":"0","Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","EnergieLabel":"","EnergieIndex":0,"Eigenaar":"","BrutoHuurBekend":false,"Brutohuur":"0","SubsidiabeleHuur":"0"},"PublicatieLabel":"","IsBewaard":false,"IsVerborgen":false,"ContractVorm":"","PublicatieOmschrijving":{"Id":"0","Tekst":null},"AantalReactiesOpPublicatie":"0","HeeftGereageerd":false,"IsIntrekkenReactieToegestaan":false,"RedenNietIntrekkenReactie":"","PositieAanbiedingsproces":"","VirtuelePositie":0,"Opleverdatum":"1900-01-01T00:00:00","HeeftLift":false,"Verdieping":"","IsMetGepersonaliseerdeHuur":false,"Voorziening":"","AanbiedingProcesSoort":"","AantalEenhedenBeschikbaar":0}},"PublicatieLijst_ParkerenOverig":{"List":[],"EmptyListItem":{"Id":"0","EinddatumTijd":"1900-01-01T00:00:00","PublicatieModel":"","PublicatieModule":"","PublicatieDatum":"1900-01-01T00:00:00","Matchpercentage":0,"VoorlopigePositie":"0","Foto_Locatie":"","GepersonaliseerdeHuur":"0","Slaagkans":0,"IsCluster":false,"EenheidSoort":"","Adres":{"Straatnaam":"","Huisnummer":0,"Huisletter":"","HuisnummerToevoeging":"","Postcode":"","Woonplaats":"","Wijk":"","PublicatieId":"0"},"Cluster":{"Naam":"","DetailSoort":"","Doelgroep":"","PrijsMinBekend":false,"PrijsMin":"0","PrijsMaxBekend":false,"PrijsMax":"0","WoonOppervlakteMinBekend":false,"WoonVertrekkenTotOppMin":0,"WoonOppervlakteMaxBekend":false,"WoonVertrekkenTotOppMax":0,"AantalEenheden":0,"AantalKamersMin":0,"AantalKamersMax":0,"Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","Eigenaar":""},"Eenheid":{"DetailSoort":"","Bestemming":"","AantalKamers":0,"TotaleOppervlakte":"0","WoonVertrekkenTotOpp":"0","Doelgroep":"","NettoHuurBekend":false,"NettoHuur":"0","Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","EnergieLabel":"","EnergieIndex":0,"Eigenaar":"","BrutoHuurBekend":false,"Brutohuur":"0","SubsidiabeleHuur":"0"},"PublicatieLabel":"","IsBewaard":false,"IsVerborgen":false,"ContractVorm":"","PublicatieOmschrijving":{"Id":"0","Tekst":null},"AantalReactiesOpPublicatie":"0","HeeftGereageerd":false,"IsIntrekkenReactieToegestaan":false,"RedenNietIntrekkenReactie":"","PositieAanbiedingsproces":"","VirtuelePositie":0,"Opleverdatum":"1900-01-01T00:00:00","HeeftLift":false,"Verdieping":"","IsMetGepersonaliseerdeHuur":false,"Voorziening":"","AanbiedingProcesSoort":"","AantalEenhedenBeschikbaar":0}},"PublicatieLijst_Koop":{"List":[],"EmptyListItem":{"Id":"0","EinddatumTijd":"1900-01-01T00:00:00","PublicatieModel":"","PublicatieModule":"","PublicatieDatum":"1900-01-01T00:00:00","Matchpercentage":0,"VoorlopigePositie":"0","Foto_Locatie":"","GepersonaliseerdeHuur":"0","Slaagkans":0,"IsCluster":false,"EenheidSoort":"","Adres":{"Straatnaam":"","Huisnummer":0,"Huisletter":"","HuisnummerToevoeging":"","Postcode":"","Woonplaats":"","Wijk":"","PublicatieId":"0"},"Cluster":{"Naam":"","DetailSoort":"","Doelgroep":"","PrijsMinBekend":false,"PrijsMin":"0","PrijsMaxBekend":false,"PrijsMax":"0","WoonOppervlakteMinBekend":false,"WoonVertrekkenTotOppMin":0,"WoonOppervlakteMaxBekend":false,"WoonVertrekkenTotOppMax":0,"AantalEenheden":0,"AantalKamersMin":0,"AantalKamersMax":0,"Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","Eigenaar":""},"Eenheid":{"DetailSoort":"","Bestemming":"","AantalKamers":0,"TotaleOppervlakte":"0","WoonVertrekkenTotOpp":"0","Doelgroep":"","NettoHuurBekend":false,"NettoHuur":"0","Lengtegraad":"0","Breedtegraad":"0","Toegankelijkheid":"","Toegankelijkheidstag":"","PublicatieId":"0","SoortBouw":"","EnergieLabel":"","EnergieIndex":0,"Eigenaar":"","BrutoHuurBekend":false,"Brutohuur":"0","SubsidiabeleHuur":"0"},"PublicatieLabel":"","IsBewaard":false,"IsVerborgen":false,"ContractVorm":"","PublicatieOmschrijving":{"Id":"0","Tekst":null},"AantalReactiesOpPublicatie":"0","HeeftGereageerd":false,"IsIntrekkenReactieToegestaan":false,"RedenNietIntrekkenReactie":"","PositieAanbiedingsproces":"","VirtuelePositie":0,"Opleverdatum":"1900-01-01T00:00:00","HeeftLift":false,"Verdieping":"","IsMetGepersonaliseerdeHuur":false,"Voorziening":"","AanbiedingProcesSoort":"","AantalEenhedenBeschikbaar":0}},"PublicatieLijst_HasAanbod":true,"PublicatieLijst_Base_TeWeinigAanbod":false,"PublicatieLijst_VerborgenItems":0,"IsAanbodReady":false,"VanActiveerScherm":false,"_vanActiveerSchermInDataFetchStatus":1,"HuidigePublicatieId":"0","_huidigePublicatieIdInDataFetchStatus":1,"ShowQiiPopup":false,"_showQiiPopupInDataFetchStatus":1,"woonplaats":"","_woonplaatsInDataFetchStatus":1,"soort":"","_soortInDataFetchStatus":1,"type":"","_typeInDataFetchStatus":1,"kamers":"","_kamersInDataFetchStatus":1,"doelgroep":"","_doelgroepInDataFetchStatus":1,"contractvorm":"","_contractvormInDataFetchStatus":1,"toegankelijkheid":"","_toegankelijkheidInDataFetchStatus":1,"aanbieder":"","_aanbiederInDataFetchStatus":1}},"clientVariables":{"Voorkeuren_LaatsteLogin":"2026-03-29T13:59:17.000Z","EnableDarkMode":false,"MK_Tijd":"0","BerichtVerwijderenActief":false,"SWVConfiguratie":"{\"SWV\":0,\"HeeftSlaagkans\":true,\"HogeKans\":60,\"RedelijkeKans\":20}","ClientLogEnabled":false,"IsVerbergenVraagNietMeer":false,"MoetInschrijfKostenBetalen":false,"SamenwerkingsverbandId":"7","IsIngelogdMetNumeriekeGebruikersnaam":false,"IsMijnOverheidVraagNietMeer":false,"ProfielPanelenIncompleet":"","MFA_ClientSettings":"","OpleidingWRBOmschrijving":"","InloggenCount":0,"Weergave_Filters":"[]","MK_Timeout":10,"IsUitgebreidZoeken":false,"CacheVariant":3,"ZoekAanbod":"","RegelingWRBNaam":"","SessionToken":"","RedirectToURLCount":"","QiiInProfiel":false,"MFA_Request":"","LastURL":"","IsVerbergKaart":false,"InschrijvenVoortzettenMogelijk":false,"RegelingIsCompleet":false,"OnExceptionCount":0,"Homepage_WaardeIsGezet":true,"IsWeergavePuntenteller":true,"MK_Gebruiker":"","SamenwerkingsverbandNaam":"Almere","Weergave_HeeftFilters":false,"SamenwerkingsverbandCode":"ALM","Homepage_GebruiktNieuweHomepage":false,"MFA_Sessie":"","IsMK":false,"OpleidingWRBNaam":"","Weergave_SorteringIsAflopend":true,"OpleidingIsCompleet":false,"Weergave_GebruikWoonwensFilter":false,"MK_Token":"","MaandenHistorie":-36,"QiiKeuzeRelatiegroepStatusCodeId":0,"MK_Woningzoekende":"","IsWeergaveEinddatum":true,"CheckProfielPanelenVoorPopup":true,"ToonNieuweProfielBerichten":false,"Weergave_HeeftSidebar":false,"Weergave_Sortering":2,"RegelingWRBOmschrijving":"","Username":"","MK_Email":"","IsLogging_MijnOverheid":true,"MFA_RequestId":"0","Weergave_HeeftKaart":true}}
```
