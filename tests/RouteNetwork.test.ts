import RouteNetwork, {
  NONE,
  RAILROAD,
  ROAD,
  capitalLink,
  cityCountsAs,
  notAnotherPlayersCity,
} from '../lib/RouteNetwork';
import Built from '@civ-clone/core-tile-improvement/Rules/Built';
import City from '@civ-clone/core-city/City';
import CityRegistry from '@civ-clone/core-city/CityRegistry';
import Effect from '@civ-clone/core-rule/Effect';
import Generator from '@civ-clone/core-world-generator/Generator';
import Pillaged from '@civ-clone/core-tile-improvement/Rules/Pillaged';
import Player from '@civ-clone/core-player/Player';
import RuleRegistry from '@civ-clone/core-rule/RuleRegistry';
import Terrain from '@civ-clone/core-terrain/Terrain';
import Tile from '@civ-clone/core-world/Tile';
import TileImprovement from '@civ-clone/core-tile-improvement/TileImprovement';
import TileImprovementRegistry from '@civ-clone/core-tile-improvement/TileImprovementRegistry';
import World from '@civ-clone/core-world/World';
import { expect } from 'chai';
import routeNetworkRules from '../lib/routeNetworkRules';

class Road extends TileImprovement {}
class Railroad extends TileImprovement {}
class Irrigation extends TileImprovement {}

const player = new Player(),
  rival = new Player();

/**
 * A world drawn as rows of characters: `.` nothing, `r` road, `R` railroad, `c` a city of `player`'s, `x` a city of
 *  `rival`'s, `i` irrigation. Cities count as railroads, as Civilization II's do (OpenCiv2 `map_path_flood` treats a
 *  city square as both road and railroad).
 */
const setUp = (
  rows: string[],
  { passableCalls = { count: 0 } }: { passableCalls?: { count: number } } = {}
) => {
  const ruleRegistry = new RuleRegistry(),
    tileImprovementRegistry = new TileImprovementRegistry(),
    cityRegistry = new CityRegistry(),
    height = rows.length,
    width = rows[0].length,
    world = new World(new Generator(height, width), ruleRegistry),
    tiles: Tile[][] = rows.map((row: string, y: number): Tile[] =>
      row.split('').map((_, x: number): Tile => {
        const tile = new Tile(x, y, new Terrain(), world, ruleRegistry);

        world.register(tile);

        return tile;
      })
    ),
    at = (x: number, y: number): Tile => tiles[y][x],
    passable = notAnotherPlayersCity(cityRegistry),
    network = new RouteNetwork({
      Road,
      Railroad,
      baseGrade: cityCountsAs(cityRegistry, RAILROAD),
      passable: (tile: Tile, who: Player): boolean => {
        passableCalls.count++;

        return passable(tile, who);
      },
      tileImprovementRegistry,
    }),
    cities: City[] = [];

  ruleRegistry.register(
    new Built(
      new Effect((tile: Tile, tileImprovement: TileImprovement): void =>
        tileImprovementRegistry.register(tileImprovement)
      )
    ),
    ...routeNetworkRules('test:route-network', network, [Road, Railroad])
  );

  rows.forEach((row: string, y: number): void =>
    row.split('').forEach((character: string, x: number): void => {
      const tile = at(x, y);

      if (character === 'r') {
        new Road(tile, ruleRegistry);
      }

      if (character === 'R') {
        new Railroad(tile, ruleRegistry);
      }

      if (character === 'i') {
        new Irrigation(tile, ruleRegistry);
      }

      if (character === 'c' || character === 'x') {
        const city = new City(
          character === 'c' ? player : rival,
          tile,
          'City',
          ruleRegistry
        );

        cityRegistry.register(city);
        cities.push(city);
      }
    })
  );

  return {
    at,
    cities,
    cityRegistry,
    network,
    ruleRegistry,
    tileImprovementRegistry,
  };
};

describe('RouteNetwork', (): void => {
  it('should join two cities by road, by railroad all the way, or not at all', (): void => {
    const { at, network } = setUp([
      '..........',
      '.crrrc....',
      '..........',
      '.cRRRc....',
      '..........',
      '.crRrc....',
      '..........',
      '.crr.rc...',
      '..........',
    ]);

    expect(network.link(player, at(1, 1), at(5, 1))).to.equal(ROAD);
    expect(network.link(player, at(1, 3), at(5, 3))).to.equal(RAILROAD);
    expect(network.link(player, at(1, 5), at(5, 5))).to.equal(ROAD);
    expect(network.link(player, at(1, 7), at(6, 7))).to.equal(NONE);
    expect(network.connected(player, at(1, 1), at(5, 1))).to.true;
    expect(network.connected(player, at(1, 7), at(6, 7))).to.false;
  });

  it('should step diagonally', (): void => {
    const { at, network } = setUp(['.c....', '..r...', '...R..', '....c.']);

    expect(network.link(player, at(1, 0), at(4, 3))).to.equal(ROAD);
  });

  it('should take the best chain when there are several', (): void => {
    const { at, network } = setUp(['.crrrc.', '.R...R.', '..RRR..']);

    expect(network.link(player, at(1, 0), at(5, 0))).to.equal(RAILROAD);
  });

  it('should count both ends as part of the chain', (): void => {
    const { at, network } = setUp(['.crrr..', '.......']);

    // The end square has no road.
    expect(network.link(player, at(1, 0), at(5, 0))).to.equal(NONE);
    expect(network.link(player, at(1, 0), at(4, 0))).to.equal(ROAD);
    // A square is joined to itself by its own grade.
    expect(network.link(player, at(1, 0), at(1, 0))).to.equal(RAILROAD);
    expect(network.link(player, at(2, 0), at(2, 0))).to.equal(ROAD);
    expect(network.link(player, at(0, 0), at(0, 0))).to.equal(NONE);
  });

  it('should join two cities side by side by railroad', (): void => {
    // OpenCiv2 `map_road_connection` checks no square between them, and answers 2.
    const { at, network } = setUp(['.cc..', '.....']);

    expect(network.link(player, at(1, 0), at(2, 0))).to.equal(RAILROAD);
  });

  it("should not pass through another player's city, but pass through its own", (): void => {
    // Blank rows between and around: the default grid wraps.
    const { at, network } = setUp([
      '.........',
      '.crrxrrc.',
      '.........',
      '.........',
      '.crrcrrc.',
      '.........',
    ]);

    expect(network.link(player, at(1, 1), at(7, 1))).to.equal(NONE);
    expect(network.link(player, at(1, 4), at(7, 4))).to.equal(ROAD);
    // The rival's own chain passes through its city.
    expect(network.link(rival, at(3, 1), at(5, 1))).to.equal(ROAD);
    expect(network.link(rival, at(1, 1), at(4, 1))).to.equal(NONE);
  });

  it('should not count other tile improvements', (): void => {
    const { at, network } = setUp(['.ciiic.', '.......']);

    expect(network.link(player, at(1, 0), at(5, 0))).to.equal(NONE);
  });

  it('should flood each component once until something changes', (): void => {
    const passableCalls = { count: 0 },
      { at, network } = setUp(['.crrrc.', '.r.....', '.c.....'], {
        passableCalls,
      });

    expect(network.link(player, at(1, 0), at(5, 0))).to.equal(ROAD);

    const afterFirst = passableCalls.count;

    expect(network.link(player, at(1, 0), at(5, 0))).to.equal(ROAD);
    // Only the two ends are asked again (whether they're usable at all): the chain between is labelled.
    expect(passableCalls.count - afterFirst).to.equal(2);

    network.invalidate();
    network.link(player, at(1, 0), at(5, 0));

    // Flooded again: the ends and every square of the component.
    expect(passableCalls.count - afterFirst - 2).to.equal(afterFirst);
  });

  it('should see a road built or pillaged, through `routeNetworkRules`', (): void => {
    const { at, network, ruleRegistry, tileImprovementRegistry } = setUp([
      '.crr.c.',
      '.......',
    ]);

    expect(network.link(player, at(1, 0), at(5, 0))).to.equal(NONE);

    const road = new Road(at(4, 0), ruleRegistry);

    expect(network.link(player, at(1, 0), at(5, 0))).to.equal(ROAD);

    tileImprovementRegistry.unregister(road);
    ruleRegistry.process(Pillaged, at(4, 0), road);

    expect(network.link(player, at(1, 0), at(5, 0))).to.equal(NONE);
  });

  it('should ignore other tile improvements built', (): void => {
    const passableCalls = { count: 0 },
      { at, network, ruleRegistry } = setUp(['.crrrc.', '.......'], {
        passableCalls,
      });

    network.link(player, at(1, 0), at(5, 0));

    const before = passableCalls.count;

    new Irrigation(at(0, 1), ruleRegistry);
    network.link(player, at(1, 0), at(5, 0));

    expect(passableCalls.count - before).to.equal(2);
  });

  it('should see a city captured', (): void => {
    const { at, cities, network } = setUp(['.crrcrrc.', '.........']);

    expect(network.link(player, at(1, 0), at(7, 0))).to.equal(ROAD);

    cities[1].capture(rival);

    expect(network.link(player, at(1, 0), at(7, 0))).to.equal(NONE);
  });

  it("should give a city's link to its owner's capital", (): void => {
    const { at, cities, network } = setUp(['.crrc..c.', '.........']),
      [capital, joined, alone] = cities;

    expect(at(1, 0) === capital.tile()).to.true;
    expect(capitalLink(network, joined, () => capital)).to.equal(ROAD);
    expect(capitalLink(network, alone, () => capital)).to.equal(NONE);
    expect(capitalLink(network, capital, () => capital)).to.equal(RAILROAD);
    expect(capitalLink(network, joined, () => null)).to.equal(null);
  });
});
