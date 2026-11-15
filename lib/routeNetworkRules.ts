import Built from '@civ-clone/core-tile-improvement/Rules/Built';
import CityCaptured from '@civ-clone/core-city/Rules/Captured';
import CityCreated from '@civ-clone/core-city/Rules/Created';
import CityDestroyed from '@civ-clone/core-city/Rules/Destroyed';
import Criterion from '@civ-clone/core-rule/Criterion';
import Effect from '@civ-clone/core-rule/Effect';
import Pillaged from '@civ-clone/core-tile-improvement/Rules/Pillaged';
import Removed from '@civ-clone/core-tile-improvement/Rules/Removed';
import RouteNetwork from './RouteNetwork';
import Rule from '@civ-clone/core-rule/Rule';
import Tile from '@civ-clone/core-world/Tile';
import TileImprovement from '@civ-clone/core-tile-improvement/TileImprovement';

/** A criterion: the tile improvement is one of `Routes`. */
export const isRoute =
  (Routes: readonly (typeof TileImprovement)[]) =>
  (tile: Tile, tileImprovement: TileImprovement): boolean =>
    Routes.some(
      (Route: typeof TileImprovement): boolean =>
        tileImprovement instanceof Route
    );

/**
 * The rules that keep `network` up to date, by forgetting its labels (`RouteNetwork#invalidate`) when one of `Routes`
 *  (the road and railroad classes) is built, pillaged or removed, and when a city is founded, captured or destroyed.
 *  Ids are `<prefix>/built`, `/pillaged`, `/removed`, `/city-created`, `/city-captured` and `/city-destroyed`.
 *
 * Forgetting is cheap: the next query floods its component again.
 */
export const routeNetworkRules = (
  prefix: string,
  network: RouteNetwork,
  Routes: readonly (typeof TileImprovement)[]
): Rule[] => {
  const invalidate = new Effect((): void => network.invalidate()),
    route = new Criterion(isRoute(Routes));

  return [
    new Built(`${prefix}/built`, route, invalidate),
    new Pillaged(`${prefix}/pillaged`, route, invalidate),
    new Removed(`${prefix}/removed`, route, invalidate),
    new CityCreated(`${prefix}/city-created`, invalidate),
    new CityCaptured(`${prefix}/city-captured`, invalidate),
    new CityDestroyed(`${prefix}/city-destroyed`, invalidate),
  ];
};

export default routeNetworkRules;
