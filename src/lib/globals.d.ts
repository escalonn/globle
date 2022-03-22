import { Country } from './country';
import { CountryColors, GameState } from '../sandbox';

declare global {
  var countryData: Country[];
  var countryColors: CountryColors;
  var showColorScheme: () => void;
  var getGameState: (possibilities: string[]) => GameState | undefined;
  var getPossibilitySet: (country: string, index: number) => string[];
  var getNextGameState: (state: GameState, country: string, index: number) => GameState;
  var playGame: (answer: string, state: GameState?) => GameState[];
  var playGameJustNames: (answer: string, state: GameState?) => string[];
  var namesToFlags: (...names: string[]) => string[];
  var flagsToNames: (...flags: string[]) => string[];
  var colorBetween: (name1: string, name2: string) => number;
  var allStates: Map<string, GameState>?;
  var initialState: GameState?;
}
