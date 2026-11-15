import RouteNetwork from './RouteNetwork';
import Rule from '@civ-clone/core-rule/Rule';
import Tile from '@civ-clone/core-world/Tile';
import TileImprovement from '@civ-clone/core-tile-improvement/TileImprovement';
/** A criterion: the tile improvement is one of `Routes`. */
export declare const isRoute: (
  Routes: readonly (typeof TileImprovement)[]
) => (tile: Tile, tileImprovement: TileImprovement) => boolean;
/**
 * The rules that keep `network` up to date, by forgetting its labels (`RouteNetwork#invalidate`) when one of `Routes`
 *  (the road and railroad classes) is built, pillaged or removed, and when a city is founded, captured or destroyed.
 *  Ids are `<prefix>/built`, `/pillaged`, `/removed`, `/city-created`, `/city-captured` and `/city-destroyed`.
 *
 * Forgetting is cheap: the next query floods its component again.
 */
export declare const routeNetworkRules: (
  prefix: string,
  network: RouteNetwork,
  Routes: readonly (typeof TileImprovement)[]
) => Rule[];
export default routeNetworkRules;
