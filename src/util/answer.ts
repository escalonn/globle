import { Country } from "../lib/country";
import { today } from "./dates";

const countryData: Country[] = require("../data/country_data.json").features;

// sorted using the second letter of the country's two-letter code,
// for some reason. but the json is already sorted that way.
countryData.sort((a, b) => {
  return a.properties.FLAG[1].localeCompare(b.properties.FLAG[1]);
});

// this behavior changed on 2022-02-16
export function generateKeyNew(list: any[], day: string) {
  const [year, month, date] = day.split("-");
  // dayCode goes up by 86_400_000 every day at client-side midnight.
  // (no precision problems for the next 300k years, cf. MAX_SAFE_INTEGER)
  const dayCode = Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(date));
  // const SHUFFLE_KEY = "1337";
  const SHUFFLE_KEY = process.env.REACT_APP_SHUFFLE_KEY || "1";
  // the quotient of dayCode divided by 13375, modulo 197 (number of countries)
  const key = Math.floor(dayCode / parseInt(SHUFFLE_KEY + "5")) % list.length;
  // the ratio goes up by 6459 + 87/107 every day,
  // so the quotient goes up by 6460 most days, 6459 other days.
  // modulo 197, this means we go forwards 156 or 155 in the list,
  // which usually amounts to moving 41 or 42 backwards in the list.
  return key;
}

const key = generateKeyNew(countryData, today);

export const answerCountry = countryData[key];
export const answerName = answerCountry.properties.NAME;
