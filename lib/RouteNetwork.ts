import {
  TileImprovementRegistry,
  instance as tileImprovementRegistryInstance,
} from '@civ-clone/core-tile-improvement/TileImprovementRegistry';
import City from '@civ-clone/core-city/City';
import CityRegistry from '@civ-clone/core-city/CityRegistry';
import Player from '@civ-clone/core-player/Player';
import Tile from '@civ-clone/core-world/Tile';
import TileImprovement from '@civ-clone/core-tile-improvement/TileImprovement';

/** How well two squares are joined: not at all, by road (some of it may be railroad), or by railroad all the way. */
export type Link = 0 | 1 | 2;

export const NONE: Link = 0;
export const ROAD: Link = 1;
export const RAILROAD: Link = 2;

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

type Components = {
  // Component number by square, for the squares labelled so far.
  road: Map<Tile, number>;
  railroad: Map<Tile, number>;
  next: number;
};

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
export class RouteNetwork {
  private _baseGrade: (tile: Tile) => Link;
  private _byPlayer: Map<Player, Components> = new Map();
  private _passable: (tile: Tile, player: Player) => boolean;
  private _Railroad: typeof TileImprovement | null;
  private _Road: typeof TileImprovement;
  private _tileImprovementRegistry: TileImprovementRegistry;

  constructor({
    Road,
    Railroad = null,
    baseGrade = (): Link => NONE,
    passable = (): boolean => true,
    tileImprovementRegistry = tileImprovementRegistryInstance,
  }: RouteNetworkOptions) {
    this._Road = Road;
    this._Railroad = Railroad;
    this._baseGrade = baseGrade;
    this._passable = passable;
    this._tileImprovementRegistry = tileImprovementRegistry;
  }

  /** The square's own grade: railroad, road or none, from what's built on it and `baseGrade`. */
  grade(tile: Tile): Link {
    let grade: Link = this._baseGrade(tile);

    if (grade === RAILROAD) {
      return grade;
    }

    for (const tileImprovement of this._tileImprovementRegistry.getByTile(
      tile
    )) {
      if (
        this._Railroad !== null &&
        tileImprovement instanceof this._Railroad
      ) {
        return RAILROAD;
      }

      if (tileImprovement instanceof this._Road) {
        grade = ROAD;
      }
    }

    return grade;
  }

  /** Forgets every label: the next query floods its component again. */
  invalidate(): void {
    this._byPlayer.clear();
  }

  /**
   * How well `from` and `to` are joined for `player`: `RAILROAD` when a chain of railroad squares joins them, else
   *  `ROAD` when a chain of road or railroad squares does, else `NONE`. The two squares are part of the chain, so each
   *  must be a road square itself (a city's square is, when `baseGrade` says so). A square is joined to itself by its
   *  own grade.
   */
  link(player: Player, from: Tile, to: Tile): Link {
    if (!this.usable(from, player) || !this.usable(to, player)) {
      return NONE;
    }

    const components = this.components(player),
      railroad = this.componentOf(components.railroad, RAILROAD, from, player);

    if (
      railroad !== null &&
      railroad === this.componentOf(components.railroad, RAILROAD, to, player)
    ) {
      return RAILROAD;
    }

    return this.componentOf(components.road, ROAD, from, player) ===
      this.componentOf(components.road, ROAD, to, player)
      ? ROAD
      : NONE;
  }

  /** Whether `from` and `to` are joined for `player` at all (`link` is `ROAD` or better). */
  connected(player: Player, from: Tile, to: Tile): boolean {
    return this.link(player, from, to) !== NONE;
  }

  private usable(tile: Tile, player: Player): boolean {
    return this.grade(tile) !== NONE && this._passable(tile, player);
  }

  private components(player: Player): Components {
    let components = this._byPlayer.get(player);

    if (!components) {
      components = { road: new Map(), railroad: new Map(), next: 0 };

      this._byPlayer.set(player, components);
    }

    return components;
  }

  /**
   * The number of `tile`'s component of squares of at least `minimum` grade, labelling the whole component (a
   *  breadth-first flood fill) the first time. `null` if the square itself isn't one.
   */
  private componentOf(
    labels: Map<Tile, number>,
    minimum: Link,
    tile: Tile,
    player: Player
  ): number | null {
    const known = labels.get(tile);

    if (known !== undefined) {
      return known;
    }

    if (this.grade(tile) < minimum || !this._passable(tile, player)) {
      return null;
    }

    const components = this.components(player),
      label = components.next++,
      queue: Tile[] = [tile];

    labels.set(tile, label);

    // An index rather than `shift()`, which is linear.
    for (let i = 0; i < queue.length; i++) {
      for (const neighbour of queue[i].getNeighbours()) {
        if (
          neighbour === undefined ||
          labels.has(neighbour) ||
          this.grade(neighbour) < minimum ||
          !this._passable(neighbour, player)
        ) {
          continue;
        }

        labels.set(neighbour, label);
        queue.push(neighbour);
      }
    }

    return label;
  }
}

/** A `baseGrade`: a square with a city on it counts as `grade` (a road, or a railroad). */
export const cityCountsAs =
  (cityRegistry: CityRegistry, grade: Link = ROAD) =>
  (tile: Tile): Link =>
    cityRegistry.getByTile(tile) === null ? NONE : grade;

/** A `passable`: no city of another player's stands on the square. */
export const notAnotherPlayersCity =
  (cityRegistry: CityRegistry) =>
  (tile: Tile, player: Player): boolean => {
    const city = cityRegistry.getByTile(tile);

    return city === null || city.player() === player;
  };

/**
 * How well `city` is joined to its owner's capital (`capitalOf`), or `null` when its owner has none. The capital
 *  itself is joined to itself by its own square's grade.
 */
export const capitalLink = (
  network: RouteNetwork,
  city: City,
  capitalOf: (player: Player) => City | null
): Link | null => {
  const player = city.player(),
    capital = capitalOf(player);

  if (capital === null) {
    return null;
  }

  return network.link(player, city.tile(), capital.tile());
};

export default RouteNetwork;
