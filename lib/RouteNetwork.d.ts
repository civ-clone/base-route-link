import { TileImprovementRegistry } from '@civ-clone/core-tile-improvement/TileImprovementRegistry';
import City from '@civ-clone/core-city/City';
import CityRegistry from '@civ-clone/core-city/CityRegistry';
import Player from '@civ-clone/core-player/Player';
import Tile from '@civ-clone/core-world/Tile';
import TileImprovement from '@civ-clone/core-tile-improvement/TileImprovement';
/** How well two squares are joined: not at all, by road (some of it may be railroad), or by railroad all the way. */
export type Link = 0 | 1 | 2;
export declare const NONE: Link;
export declare const ROAD: Link;
export declare const RAILROAD: Link;
export interface RouteNetworkOptions {
  /** The road class: a square with one of these (or a subclass) is a road square. */
  Road: typeof TileImprovement;
  /** The railroad class: a square with one is a railroad square. None, and nothing is ever joined by railroad. */
  Railroad?: typeof TileImprovement | null;
  /**
   * The grade a square has whatever is built on it: how a rule set says a city's square counts as a road (or as a
   *  railroad). See `cityCountsAs`. Default: none.
   */
  baseGrade?: (tile: Tile) => Link;
  /**
   * Whether a link of `player`'s may use `tile`, such as "no city of another player's stands on it" (see
   *  `notAnotherPlayersCity`). Asked of the two ends too. Default: always.
   */
  passable?: (tile: Tile, player: Player) => boolean;
  tileImprovementRegistry?: TileImprovementRegistry;
}
/**
 * The road and railroad network: whether two squares are joined by an unbroken chain of road (or railroad) squares,
 *  each next to the last, for a given player.
 *
 * **Cost.** Each player's network is labelled into connected components lazily, a flood fill from the first square
 *  asked about in each component, and the labels are kept until `invalidate()`. So a query is a lookup once its
 *  component is labelled, however many cities ask. Labels depend on what's built and on `passable`, so call
 *  `invalidate()` whenever either changes; `routeNetworkRules` does it for roads and railroads built, pillaged or
 *  removed and for cities founded, captured or destroyed. Anything else `passable` or `baseGrade` reads is the rule
 *  set's to invalidate.
 *
 * Nothing is stored on a game entity, so nothing is saved: a loaded game starts with nothing labelled.
 */
export declare class RouteNetwork {
  private _baseGrade;
  private _byPlayer;
  private _passable;
  private _Railroad;
  private _Road;
  private _tileImprovementRegistry;
  constructor({
    Road,
    Railroad,
    baseGrade,
    passable,
    tileImprovementRegistry,
  }: RouteNetworkOptions);
  /** The square's own grade: railroad, road or none, from what's built on it and `baseGrade`. */
  grade(tile: Tile): Link;
  /** Forgets every label: the next query floods its component again. */
  invalidate(): void;
  /**
   * How well `from` and `to` are joined for `player`: `RAILROAD` when a chain of railroad squares joins them, else
   *  `ROAD` when a chain of road or railroad squares does, else `NONE`. The two squares are part of the chain, so each
   *  must be a road square itself (a city's square is, when `baseGrade` says so). A square is joined to itself by its
   *  own grade.
   */
  link(player: Player, from: Tile, to: Tile): Link;
  /** Whether `from` and `to` are joined for `player` at all (`link` is `ROAD` or better). */
  connected(player: Player, from: Tile, to: Tile): boolean;
  private usable;
  private components;
  /**
   * The number of `tile`'s component of squares of at least `minimum` grade, labelling the whole component (a
   *  breadth-first flood fill) the first time. `null` if the square itself isn't one.
   */
  private componentOf;
}
/** A `baseGrade`: a square with a city on it counts as `grade` (a road, or a railroad). */
export declare const cityCountsAs: (
  cityRegistry: CityRegistry,
  grade?: Link
) => (tile: Tile) => Link;
/** A `passable`: no city of another player's stands on the square. */
export declare const notAnotherPlayersCity: (
  cityRegistry: CityRegistry
) => (tile: Tile, player: Player) => boolean;
/**
 * How well `city` is joined to its owner's capital (`capitalOf`), or `null` when its owner has none. The capital
 *  itself is joined to itself by its own square's grade.
 */
export declare const capitalLink: (
  network: RouteNetwork,
  city: City,
  capitalOf: (player: Player) => City | null
) => Link | null;
export default RouteNetwork;
