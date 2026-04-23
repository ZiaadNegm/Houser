import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseListings } from "./listings.ts";

function rawItem(overrides: Record<string, unknown> = {}) {
  return {
    Id: "111",
    EenheidSoort: "Woonruimte",
    VoorlopigePositie: "42",
    EinddatumTijd: "2099-01-01T00:00:00",
    HeeftGereageerd: false,
    IsIntrekkenReactieToegestaan: false,
    AantalReactiesOpPublicatie: "10",
    ContractVorm: "Onbepaalde tijd",
    Foto_Locatie: "",
    Adres: {
      Straatnaam: "Teststraat",
      Huisnummer: 1,
      Huisletter: "",
      Postcode: "1234AB",
      Woonplaats: "Almere",
      Wijk: "Testwijk",
    },
    Eenheid: {
      DetailSoort: "Portiekflat",
      AantalKamers: 3,
      NettoHuur: "700",
      EnergieLabel: "A",
      Eigenaar: "TestCorp",
    },
    ...overrides,
  };
}

Deno.test("parseListings keeps dwellings and drops non-dwellings", () => {
  const raw = [
    rawItem({ Id: "dwelling", EenheidSoort: "Woonruimte" }),
    rawItem({ Id: "parking", EenheidSoort: "Parkeren" }),
    rawItem({ Id: "garage", EenheidSoort: "Garage" }),
  ];
  const { listings, skippedNonDwellingCount, skippedUnitTypeBreakdown } =
    parseListings(raw);
  assertEquals(listings.length, 1);
  assertEquals(listings[0].id, "dwelling");
  assertEquals(skippedNonDwellingCount, 2);
  assertEquals(skippedUnitTypeBreakdown, { Parkeren: 1, Garage: 1 });
});

Deno.test("parseListings treats missing EenheidSoort as skipped (safer default)", () => {
  const raw = [
    rawItem({ Id: "noType", EenheidSoort: undefined }),
    rawItem({ Id: "empty", EenheidSoort: "" }),
    rawItem({ Id: "ok", EenheidSoort: "Woonruimte" }),
  ];
  const { listings, skippedNonDwellingCount, skippedUnitTypeBreakdown } =
    parseListings(raw);
  assertEquals(listings.map((l) => l.id), ["ok"]);
  assertEquals(skippedNonDwellingCount, 2);
  assertEquals(skippedUnitTypeBreakdown, { "<missing>": 2 });
});

Deno.test("parseListings maps all dwelling fields correctly", () => {
  const { listings } = parseListings([rawItem()]);
  const l = listings[0];
  assertEquals(l.id, "111");
  assertEquals(l.address, "Teststraat 1, Almere");
  assertEquals(l.neighborhood, "Testwijk");
  assertEquals(l.postcode, "1234AB");
  assertEquals(l.position, 42);
  assertEquals(l.rooms, 3);
  assertEquals(l.rentNet, "700");
  assertEquals(l.propertyType, "Portiekflat");
});

Deno.test("parseListings on empty input returns empty result", () => {
  const { listings, skippedNonDwellingCount, skippedUnitTypeBreakdown } =
    parseListings([]);
  assertEquals(listings, []);
  assertEquals(skippedNonDwellingCount, 0);
  assertEquals(skippedUnitTypeBreakdown, {});
});
