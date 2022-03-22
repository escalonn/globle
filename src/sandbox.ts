import { scaleSequentialSqrt } from 'd3-scale';
import { interpolateOrRd, schemeOrRd } from 'd3-scale-chromatic';
import { color } from 'd3-color';
import { differenceCiede2000 } from 'd3-color-difference';
import { polygonDistance } from './util/distance';

interface CountryDistances {
  [c1: string]: {
    [c2: string]: number;
  };
}

export interface CountryColors {
  colorScheme: { color: string, cutoff: number }[];
  countries: {
    [c1: string]: {
      name: string;
      indices: {
        [c2: string]: number;
      };
      sets: {
        [i: number]: string[];
      };
    };
  };
}

// 195 (UN) + Taiwan, Kosovo
globalThis.countryData = require('./data/country_data.json').features;

const distances: CountryDistances = require('./country_distances.json');
// const distances: CountryDistances = {};

globalThis.countryColors = require('./country_colors.json');
// globalThis.countryColors = {};
let colorIndices = countryColors.countries;

const NUMBER_OF_COLORS = 9;
// const NUMBER_OF_COLORS = 6;
const colorFunction = interpolateOrRd;
let colorScheme = schemeOrRd[NUMBER_OF_COLORS];

const flagToName = new Map<string, string>();
const nameToFlag = new Map<string, string>();

for (const country of countryData) {
  flagToName.set(country.properties.FLAG, country.properties.NAME);
  nameToFlag.set(country.properties.NAME, country.properties.FLAG);
}

export class GameState {
  bestGuesses?: string[];
  score?: [number, number];

  private constructor(public possibilities: string[]) {}

  private static makeKey(possibilities: string[]) {
    return possibilities.join();
  }

  static create(possibilities: string[]) {
    const key = this.makeKey(possibilities);
    let state = this.allStates.get(key);
    if (!state) {
      state = new GameState(possibilities);
      this.allStates.set(key, state);
      // this.statesCount++;
      // if (this.statesCount % 100 === 0) {
      //   console.log(this.statesCount);
      // }
      // console.log(
      //   possibilities.length > 10 ? possibilities.length : possibilities.toString()
      // );
    }
    return state;
  }

  static async setup() {
    const response = await fetch('data/all_states.json');
    const obj = await response.json();
    GameState.allStates = new Map<string, GameState>(Object.entries(obj));
  }

  static allStates = new Map<string, GameState>();
  // static statesCount = 0;

  // evaluate(first = false) {
  evaluate() {
    let minimax = [Number.MAX_VALUE, Number.MAX_VALUE];
    // for (let i = 0; i < this.possibilities.length; i++) {
    //   const guess = this.possibilities[i];
    for (const guess of this.possibilities) {
      let maxScore = 0;
      let sumOfAvgScores = 0;
      for (const answer of this.possibilities) {
        // for (let j = 0; j < this.possibilities.length; j++) {
        //   const answer = this.possibilities[j];
        if (guess === answer) continue; // base case; maxScore is never changed from 0
        const relatedIndices = colorIndices[guess];
        const observedIndex = relatedIndices.indices[answer];
        // if (first) {
        //   const percent =
        //     ((i * this.possibilities.length + j) /
        //       (this.possibilities.length * this.possibilities.length)) *
        //     100;
        //   console.log(
        //     `${flagToName.get(guess)} (${flagToName.get(
        //       answer
        //     )}, ${observedIndex}) ${percent.toFixed(4)}%`
        //   );
        // }
        const remainingPossibilities = this.possibilities.filter(
          x => relatedIndices.indices[x] === observedIndex && x !== guess
        );
        const childState = GameState.create(remainingPossibilities);

        if (childState.score === undefined) childState.evaluate();

        maxScore = Math.max(maxScore, childState.score![0]);
        // must update maxScore so minimax isn't updated after break
        if (childState.score![0] > minimax[0]) break; // this guess has a worse worst case than an already seen one; prune
        sumOfAvgScores += childState.score![1];
      }
      const evScore = sumOfAvgScores / this.possibilities.length;
      if (
        maxScore < minimax[0] ||
        (maxScore === minimax[0] && evScore < minimax[1])
      ) {
        minimax = [maxScore, evScore];
        this.bestGuesses = [guess];
      } else if (
        maxScore === minimax[0] &&
        Math.abs(evScore - minimax[1]) < 0.00001
      ) {
        this.bestGuesses!.push(guess);
      }
      // consider how to keep track of child states
    }
    this.score = [minimax[0] + 1, minimax[1] + 1];
  }

  // must be same length
  static maxTuple(a: number[], b: number[]) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] > b[i]) return a;
      if (a[i] < b[i]) return b;
    }
    return a;
  }
}

// function computeColorScheme(num: number) {
//   const result = [];
//   for (let i = 0; i < num; i++) {
//     result.push(color(colorFunction(i / num))?.formatHex);
//   }
//   return result;
// }

export async function outputInfo() {
  // for (let i = 0; i < colorScheme.length; i++) {
  //   console.log(
  //     `%c    ${i}    `,
  //     `color: black; background-color: ${colorScheme[i]}`
  //   );
  // }

  // colorScheme = computeColorScheme(NUMBER_OF_COLORS);

  await GameState.setup();

  const initialCountries = countryData.map(x => x.properties.FLAG);
  const initial = GameState.create(initialCountries);

  if (GameState.allStates.size <= 1) {
    if (countryColors.colorScheme.map(x => x.color).toString() === colorScheme.toString()) {
      console.log('country color indices found');
    } else {
      computePartitionedColors();
    }

    // const initialCountries = 'GB,BE,NL,NO,FR,TR,GR,LU'.split(',');
    // const initialCountries = 'ME,SI,RS'.split(',');
    console.log('starting evaluation');
    console.time('evaluate');
    initial.evaluate();
    // initial.evaluate(true);
    console.timeEnd('evaluate');
  }

  showColorScheme();

  globalThis.allStates = GameState.allStates;
  globalThis.initialState = initial;

  console.log(GameState.allStates);
  console.log(initial);
  console.log(initial.bestGuesses!.map(x => flagToName.get(x)).sort());
}

globalThis.showColorScheme = () => {
  console.log('color index reference:');
  for (let i = 0; i < colorScheme.length; i++) {
    const km = Math.round(countryColors.colorScheme[i].cutoff);
    console.log(
      `%c    ${i} (${String(km).padStart(5)})    `,
      `color: black; background-color: ${colorScheme[i]}`
    );
  }
};

globalThis.getGameState = possibilities => {
  if (!allStates) throw new Error('states unevaluated');
  return GameState.create(possibilities);
};

globalThis.getPossibilitySet = (country, index) => {
  if (!allStates) throw new Error('states unevaluated');
  const flag = nameToFlag.get(country);
  if (!flag) throw new Error('no such country');
  return colorIndices[flag].sets[index];
}

globalThis.getNextGameState = (state, country, index) => {
  const set = new Set(getPossibilitySet(country, index));
  const remaining = state.possibilities.filter(x => set.has(x));
  return GameState.create(remaining);
};

globalThis.playGame = (answer, state) => {
  if (!state) state = initialState;
  if (!state) throw new Error('states unevaluated');
  const result = [state];
  const answerFlag = namesToFlags(answer)[0];
  while (true) {
    if (!state.bestGuesses) throw new Error('state unevaluated');
    const guess = state.bestGuesses[0];
    if (answerFlag === guess) break;
    const index = colorIndices[answerFlag].indices[guess];
    state = getNextGameState(state, flagsToNames(guess)[0], index);
    // if (state.possibilities.length === 0) break;
    if (!state.bestGuesses) state.evaluate();
    result.push(state);
  }
  return result;
};

globalThis.playGameJustNames = (answer, state) => {
  return playGame(answer, state).map(x => flagsToNames(x.bestGuesses![0])[0]);
}

globalThis.namesToFlags = (...names) => names.map(x => {
  const result = nameToFlag.get(x);
  if (!result) throw new Error(`invalid ${x}`);
  return result;
});

globalThis.flagsToNames = (...flags) => flags.map(x => {
  const result = flagToName.get(x);
  if (!result) throw new Error(`invalid ${x}`);
  return result;
});

globalThis.colorBetween = (name1, name2) =>
  countryColors.countries[namesToFlags(name1)[0]]
    .indices[namesToFlags(name2)[0]];

function computeCountryDistances() {
  console.log('outputting country distances');
  for (let i = 0; i < countryData.length; i++) {
    const country1 = countryData[i];
    const country1Name = country1.properties.NAME;
    distances[country1Name] = {};
    console.log(`${i} ${country1Name}`);
    for (let j = 0; j < countryData.length; j++) {
      const country2 = countryData[j];
      const country2Name = country2.properties.NAME;
      let distance: number;
      if (
        distances[country2Name] &&
        distances[country2Name][country1Name] !== undefined
      ) {
        distance = distances[country2Name][country1Name];
      } else {
        distance = polygonDistance(country1, country2);
      }
      distances[country1Name][country2Name] = distance;
    }
  }

  console.log(distances);
  console.log(JSON.stringify(distances));
}

function computePartitionedColors() {
  if (Object.keys(distances).length > 0) {
    console.log('country distances found');
  } else {
    computeCountryDistances();
  }

  console.time('compute country color indices');
  colorIndices = {};
  countryColors = {
    colorScheme: colorScheme.map(c => ({ color: c, cutoff: -1 })),
    countries: colorIndices
  };
  const nameToFlag = new Map();
  for (const country of countryData) {
    nameToFlag.set(country.properties.NAME, country.properties.FLAG);
  }
  const minMaxDistanceByIndex = new Map();
  const MAX_DISTANCE = 15_000_000;
  const domain = [MAX_DISTANCE, 0];
  const colorScale = scaleSequentialSqrt(colorFunction).domain(domain);
  const schemeColors = colorScheme.map(x => color(x));

  for (const [country1Name, countries] of Object.entries(distances)) {
    // use FLAG since it is defined and distinct for all 197 countries, unlike e.g. ISO_A2_EH
    const country1 = nameToFlag.get(country1Name);
    colorIndices[country1] = { name: country1Name, indices: {}, sets: {} };
    for (const [country2Name, distance] of Object.entries(countries)) {
      if (country2Name === country1Name) continue;
      const country2 = nameToFlag.get(country2Name);
      const colorString = colorScale(distance);
      const exactColor = color(colorString);

      let minDifference = Number.MAX_VALUE;
      let indexOfMin = -1;
      for (let i = 0; i < schemeColors.length; i++) {
        const thisDifference = differenceCiede2000(exactColor, schemeColors[i]);
        if (thisDifference < minDifference) {
          minDifference = thisDifference;
          indexOfMin = i;
        }
      }

      colorIndices[country1].indices[country2] = indexOfMin;
      if (!colorIndices[country1].sets[indexOfMin]) {
        colorIndices[country1].sets[indexOfMin] = [];
      }
      colorIndices[country1].sets[indexOfMin].push(country2);

      if (!minMaxDistanceByIndex.has(indexOfMin)) {
        minMaxDistanceByIndex.set(indexOfMin, {
          min: Number.POSITIVE_INFINITY,
          max: Number.NEGATIVE_INFINITY
        });
      }
      const minMax = minMaxDistanceByIndex.get(indexOfMin);
      if (distance < minMax.min) {
        minMax.min = distance;
      }
      if (distance > minMax.max) {
        minMax.max = distance;
      }
    }
    // for (const list of Object.values(colorIndices[country1].sets)) {
    //   list.sort();
    // }
  }
  for (let i = 0; i < schemeColors.length - 1; i++) {
    const lighter = minMaxDistanceByIndex.get(i);
    const darker = minMaxDistanceByIndex.get(i + 1);
    countryColors.colorScheme[i].cutoff = (lighter.min + darker.max) / 2 / 1000;
  }
  countryColors.colorScheme[schemeColors.length - 1].cutoff = 0;

  console.timeEnd('compute country color indices');

  // console.log(colorIndices);
  console.log(JSON.stringify(countryColors));
}
