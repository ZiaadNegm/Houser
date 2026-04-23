import type {
  FetchListingsResult,
  WoningNetListing,
  WoningNetSession,
} from "./types.ts";
import { woningNetFetch } from "./client.ts";
import { API_VERSIONS } from "./constants.ts";

const LISTINGS_ENDPOINT =
  "/screenservices/DAKWP/Overzicht/WoningOverzicht/DataActionHaalPassendAanbod";
const LISTINGS_VIEW = "Overzicht.WoningOverzicht";

// deno-lint-ignore no-explicit-any
const EMPTY_LIST_ITEM: any = {
  Id: "0",
  EinddatumTijd: "1900-01-01T00:00:00",
  PublicatieModel: "",
  PublicatieModule: "",
  PublicatieDatum: "1900-01-01T00:00:00",
  Matchpercentage: 0,
  VoorlopigePositie: "0",
  Foto_Locatie: "",
  GepersonaliseerdeHuur: "0",
  Slaagkans: 0,
  IsCluster: false,
  EenheidSoort: "",
  Adres: {
    Straatnaam: "",
    Huisnummer: 0,
    Huisletter: "",
    HuisnummerToevoeging: "",
    Postcode: "",
    Woonplaats: "",
    Wijk: "",
    PublicatieId: "0",
  },
  Cluster: {
    Naam: "",
    DetailSoort: "",
    Doelgroep: "",
    PrijsMinBekend: false,
    PrijsMin: "0",
    PrijsMaxBekend: false,
    PrijsMax: "0",
    WoonOppervlakteMinBekend: false,
    WoonVertrekkenTotOppMin: 0,
    WoonOppervlakteMaxBekend: false,
    WoonVertrekkenTotOppMax: 0,
    AantalEenheden: 0,
    AantalKamersMin: 0,
    AantalKamersMax: 0,
    Lengtegraad: "0",
    Breedtegraad: "0",
    Toegankelijkheid: "",
    Toegankelijkheidstag: "",
    PublicatieId: "0",
    SoortBouw: "",
    Eigenaar: "",
  },
  Eenheid: {
    DetailSoort: "",
    Bestemming: "",
    AantalKamers: 0,
    TotaleOppervlakte: "0",
    WoonVertrekkenTotOpp: "0",
    Doelgroep: "",
    NettoHuurBekend: false,
    NettoHuur: "0",
    Lengtegraad: "0",
    Breedtegraad: "0",
    Toegankelijkheid: "",
    Toegankelijkheidstag: "",
    PublicatieId: "0",
    SoortBouw: "",
    EnergieLabel: "",
    EnergieIndex: 0,
    Eigenaar: "",
    BrutoHuurBekend: false,
    Brutohuur: "0",
    SubsidiabeleHuur: "0",
  },
  PublicatieLabel: "",
  IsBewaard: false,
  IsVerborgen: false,
  ContractVorm: "",
  PublicatieOmschrijving: { Id: "0", Tekst: null },
  AantalReactiesOpPublicatie: "0",
  HeeftGereageerd: false,
  IsIntrekkenReactieToegestaan: false,
  RedenNietIntrekkenReactie: "",
  PositieAanbiedingsproces: "",
  VirtuelePositie: 0,
  Opleverdatum: "1900-01-01T00:00:00",
  HeeftLift: false,
  Verdieping: "",
  IsMetGepersonaliseerdeHuur: false,
  Voorziening: "",
  AanbiedingProcesSoort: "",
  AantalEenhedenBeschikbaar: 0,
};

const EMPTY_FILTER_LIST_ITEM = {
  Naam: "",
  IsGeselecteerd: false,
  Id: "0",
  Categorie: "",
  Aantal: 0,
  IsVisible: true,
  IsEmptyValue: false,
};

function emptyFilterList() {
  return { List: [], EmptyListItem: EMPTY_FILTER_LIST_ITEM };
}

function emptyPublicatieLijst() {
  return { List: [], EmptyListItem: EMPTY_LIST_ITEM };
}

function emptyFilters() {
  return {
    Woonplaatsen: emptyFilterList(),
    Eigenaren: emptyFilterList(),
    TypeWoning: emptyFilterList(),
    AantalKamers: emptyFilterList(),
    Aanbodmodel: emptyFilterList(),
    Doelgroep: emptyFilterList(),
    Voorzieningen: emptyFilterList(),
    Contractvormen: emptyFilterList(),
    Toegankelijkheid: emptyFilterList(),
    OnzichtbareFilters: emptyFilterList(),
    MaxPrijs: 0,
    MinPrijs: 0,
    Sortering: 0,
    SorteringIsAscending: false,
  };
}

/**
 * Build the ~20KB request body for the listings endpoint.
 * Only variable: SamenwerkingsverbandId (pass "7" for Almere).
 * versionInfo and viewName are injected by woningNetFetch.
 */
export function buildListingsRequestBody(
  samenwerkingsverbandId: string,
): Record<string, unknown> {
  return {
    screenData: {
      variables: {
        ActiefTabblad: 0,
        Platform: "",
        PlatformVersie: "",
        ShowPopup: false,
        IncompleteProfielOnderdelen: {
          List: [],
          EmptyListItem: {
            ProfielPanelenId: 0,
            WeerTeGevenNaam: "",
            WRBNaam: "",
            WRBOmschrijving: "",
            IsCompleet: false,
            BinnenkortBeschikbaar: false,
          },
        },
        LegeLijst: {
          List: [],
          EmptyListItem: {
            ProfielPanelenId: 0,
            WeerTeGevenNaam: "",
            WRBNaam: "",
            WRBOmschrijving: "",
            IsCompleet: false,
            BinnenkortBeschikbaar: false,
          },
        },
        AantalVerborgenWoningen: 0,
        AdvertentielijstContainerId: "",
        MapandFiltersContainerId: "",
        Filters: emptyFilters(),
        Filters_Basis: emptyFilters(),
        Filters_ChipList: {
          List: [],
          EmptyListItem: { Categorie: "", Label: "", IsGroen: false },
        },
        FilterMenu_Trigger: true,
        PublicatieLijst_Basis: emptyPublicatieLijst(),
        PublicatieLijst_Gefilterd: emptyPublicatieLijst(),
        PublicatieLijst_Aanbod: emptyPublicatieLijst(),
        PublicatieLijst_MiddenHuur: emptyPublicatieLijst(),
        PublicatieLijst_Loting: emptyPublicatieLijst(),
        PublicatieLijst_VrijeSector: emptyPublicatieLijst(),
        PublicatieLijst_ParkerenOverig: emptyPublicatieLijst(),
        PublicatieLijst_Koop: emptyPublicatieLijst(),
        PublicatieLijst_HasAanbod: true,
        PublicatieLijst_Base_TeWeinigAanbod: false,
        PublicatieLijst_VerborgenItems: 0,
        IsAanbodReady: false,
        VanActiveerScherm: false,
        _vanActiveerSchermInDataFetchStatus: 1,
        HuidigePublicatieId: "0",
        _huidigePublicatieIdInDataFetchStatus: 1,
        ShowQiiPopup: false,
        _showQiiPopupInDataFetchStatus: 1,
        woonplaats: "",
        _woonplaatsInDataFetchStatus: 1,
        soort: "",
        _soortInDataFetchStatus: 1,
        type: "",
        _typeInDataFetchStatus: 1,
        kamers: "",
        _kamersInDataFetchStatus: 1,
        doelgroep: "",
        _doelgroepInDataFetchStatus: 1,
        contractvorm: "",
        _contractvormInDataFetchStatus: 1,
        toegankelijkheid: "",
        _toegankelijkheidInDataFetchStatus: 1,
        aanbieder: "",
        _aanbiederInDataFetchStatus: 1,
      },
    },
    clientVariables: {
      Voorkeuren_LaatsteLogin: "2026-03-29T13:59:17.000Z",
      EnableDarkMode: false,
      MK_Tijd: "0",
      BerichtVerwijderenActief: false,
      SWVConfiguratie:
        '{"SWV":0,"HeeftSlaagkans":true,"HogeKans":60,"RedelijkeKans":20}',
      ClientLogEnabled: false,
      IsVerbergenVraagNietMeer: false,
      MoetInschrijfKostenBetalen: false,
      SamenwerkingsverbandId: samenwerkingsverbandId,
      IsIngelogdMetNumeriekeGebruikersnaam: false,
      IsMijnOverheidVraagNietMeer: false,
      ProfielPanelenIncompleet: "",
      MFA_ClientSettings: "",
      OpleidingWRBOmschrijving: "",
      InloggenCount: 0,
      Weergave_Filters: "[]",
      MK_Timeout: 10,
      IsUitgebreidZoeken: false,
      CacheVariant: 3,
      ZoekAanbod: "",
      RegelingWRBNaam: "",
      SessionToken: "",
      RedirectToURLCount: "",
      QiiInProfiel: false,
      MFA_Request: "",
      LastURL: "",
      IsVerbergKaart: false,
      InschrijvenVoortzettenMogelijk: false,
      RegelingIsCompleet: false,
      OnExceptionCount: 0,
      Homepage_WaardeIsGezet: true,
      IsWeergavePuntenteller: true,
      MK_Gebruiker: "",
      SamenwerkingsverbandNaam: "Almere",
      Weergave_HeeftFilters: false,
      SamenwerkingsverbandCode: "ALM",
      Homepage_GebruiktNieuweHomepage: false,
      MFA_Sessie: "",
      IsMK: false,
      OpleidingWRBNaam: "",
      Weergave_SorteringIsAflopend: true,
      OpleidingIsCompleet: false,
      Weergave_GebruikWoonwensFilter: false,
      MK_Token: "",
      MaandenHistorie: -36,
      QiiKeuzeRelatiegroepStatusCodeId: 0,
      MK_Woningzoekende: "",
      IsWeergaveEinddatum: true,
      CheckProfielPanelenVoorPopup: true,
      ToonNieuweProfielBerichten: false,
      Weergave_HeeftSidebar: false,
      Weergave_Sortering: 2,
      RegelingWRBOmschrijving: "",
      Username: "",
      MK_Email: "",
      IsLogging_MijnOverheid: true,
      MFA_RequestId: "0",
      Weergave_HeeftKaart: true,
    },
  };
}

// WoningNet mixes dwellings and non-dwellings (parkeerplaatsen, bergingen, …) into
// the same PublicatieLijst.List[]. We only ever want to apply to dwellings, so we
// drop anything whose root-level EenheidSoort is not exactly "Woonruimte".
// Allow-list (not deny-list) on purpose: if WoningNet introduces a new non-dwelling
// EenheidSoort tomorrow, we stay safe instead of auto-applying to it.
const DWELLING_UNIT_TYPE = "Woonruimte";

export interface ParseListingsResult {
  listings: WoningNetListing[];
  skippedNonDwellingCount: number;
  skippedUnitTypeBreakdown: Record<string, number>;
}

/**
 * Parse raw WoningNet listing items into normalized WoningNetListing objects.
 * Drops non-dwelling units (parkeerplaatsen etc.) — we never want to apply to those.
 * Defensive: uses fallbacks for missing/unparseable fields.
 */
// deno-lint-ignore no-explicit-any
export function parseListings(rawList: any[]): ParseListingsResult {
  const listings: WoningNetListing[] = [];
  const breakdown: Record<string, number> = {};
  let skipped = 0;

  for (const item of rawList) {
    const unitType = String(item.EenheidSoort ?? "");
    if (unitType !== DWELLING_UNIT_TYPE) {
      skipped++;
      const key = unitType || "<missing>";
      breakdown[key] = (breakdown[key] ?? 0) + 1;
      continue;
    }
    listings.push({
      id: String(item.Id ?? ""),
      address: `${item.Adres?.Straatnaam ?? ""} ${item.Adres?.Huisnummer ?? ""}${item.Adres?.Huisletter || ""}, ${item.Adres?.Woonplaats ?? ""}`,
      neighborhood: item.Adres?.Wijk ?? "",
      position: parseInt(item.VoorlopigePositie, 10) || 9999,
      rooms: item.Eenheid?.AantalKamers ?? 0,
      rentNet: item.Eenheid?.NettoHuur ?? "0",
      contractType: item.ContractVorm ?? "",
      propertyType: item.Eenheid?.DetailSoort ?? "",
      deadline: item.EinddatumTijd ?? "",
      hasApplied: item.HeeftGereageerd === true,
      canRevoke: item.IsIntrekkenReactieToegestaan === true,
      imageUrl: item.Foto_Locatie ?? "",
    });
  }

  return {
    listings,
    skippedNonDwellingCount: skipped,
    skippedUnitTypeBreakdown: breakdown,
  };
}

/**
 * Fetch current listings from WoningNet and parse them.
 * Uses the authenticated session from login().
 */
export async function fetchListings(
  session: WoningNetSession,
): Promise<{ result: FetchListingsResult; session: WoningNetSession }> {
  const body = buildListingsRequestBody("7");

  const { data, session: updatedSession } = await woningNetFetch(
    session,
    LISTINGS_ENDPOINT,
    body,
    API_VERSIONS.fetchListings,
    LISTINGS_VIEW,
  );

  const rawList = data?.PublicatieLijst?.List;
  if (!Array.isArray(rawList)) {
    throw new Error(
      "Unexpected listings response: PublicatieLijst.List not found",
    );
  }

  const { listings, skippedNonDwellingCount, skippedUnitTypeBreakdown } =
    parseListings(rawList);
  console.log(
    `[woningnet:listings] Parsed ${listings.length} dwellings from ${rawList.length} raw items (skipped ${skippedNonDwellingCount} non-dwellings: ${JSON.stringify(skippedUnitTypeBreakdown)})`,
  );

  return {
    result: {
      listings,
      rawCount: rawList.length,
      skippedNonDwellingCount,
      skippedUnitTypeBreakdown,
    },
    session: updatedSession,
  };
}
