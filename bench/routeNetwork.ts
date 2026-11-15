import RouteNetwork, {
  Link,
  RAILROAD,
  capitalLink,
  cityCountsAs,
  notAnotherPlayersCity,
} from '../lib/RouteNetwork';
import City from '@civ-clone/core-city/City';
import CityRegistry from '@civ-clone/core-city/CityRegistry';
import Generator from '@civ-clone/core-world-generator/Generator';
import Player from '@civ-clone/core-player/Player';
import RuleRegistry from '@civ-clone/core-rule/RuleRegistry';
import Terrain from '@civ-clone/core-terrain/Terrain';
import Tile from '@civ-clone/core-world/Tile';
import TileImprovement from '@civ-clone/core-tile-improvement/TileImprovement';
import TileImprovementRegistry from '@civ-clone/core-tile-improvement/TileImprovementRegistry';
import World from '@civ-clone/core-world/World';
import { expect } from 'chai';
import { readFileSync } from 'fs';

// `npm run bench`, not part of `npm test`. Logs what a city's link to its capital costs, for every city on a map,
//  with the labels cold (just invalidated: each component flooded once) and warm, against a flood fill for each city
//  (what this caches away). It asserts only that all three give the same answers, never a timing.
//
// `ROUTE_FIXTURE=<file.json>` benches a real map: `{ width, height, roads: [[x, y]], railroads: [[x, y]], cities:
//  [[x, y, owner, isCapital]] }`, as dumped from a late saved game. Without it, a synthetic 120 × 90 map: a road grid
//  every 4 squares, a third of it railroad, 200 cities of 8 players.

type Fixture = {
  width: number;
  height: number;
  roads: [number, number][];
  railroads: [number, number][];
  cities: [number, number, string, boolean][];
};

const synthetic = (): Fixture => {
  const width = 120,
    height = 90,
    roads: [number, number][] = [],
    railroads: [number, number][] = [],
    cities: [number, number, string, boolean][] = [];

  for (let y = 2; y < height - 2; y++) {
    for (let x = 0; x < width; x++) {
      if (x % 4 === 0 || y % 4 === 0) {
        (x % 12 === 0 ? railroads : roads).push([x, y]);
      }
    }
  }

  for (let i = 0; i < 200; i++) {
    const x = (i * 37) % width,
      y = 4 + ((i * 53) % (height - 8));

    cities.push([x - (x % 4), y - (y % 4), `p${i % 8}`, i < 8]);
  }

  return { width, height, roads, railroads, cities };
};

describe('route links: timings (logged, not asserted)', (): void => {
  const fixture: Fixture = process.env.ROUTE_FIXTURE
      ? JSON.parse(readFileSync(process.env.ROUTE_FIXTURE, 'utf8'))
      : synthetic(),
    ruleRegistry = new RuleRegistry(),
    tileImprovementRegistry = new TileImprovementRegistry(),
    cityRegistry = new CityRegistry(),
    world = new World(
      new Generator(fixture.height, fixture.width),
      ruleRegistry
    ),
    tiles: Tile[] = [],
    players = new Map<string, Player>(),
    capitals = new Map<Player, City>();

  class Road extends TileImprovement {}
  class Railroad extends TileImprovement {}

  for (let y = 0; y < fixture.height; y++) {
    for (let x = 0; x < fixture.width; x++) {
      const tile = new Tile(x, y, new Terrain(), world, ruleRegistry);

      world.register(tile);
      tiles.push(tile);
    }
  }

  // Nothing registers on `Built` here, so register by hand.
  fixture.roads.forEach(([x, y]) =>
    tileImprovementRegistry.register(new Road(world.get(x, y), ruleRegistry))
  );
  fixture.railroads.forEach(([x, y]) =>
    tileImprovementRegistry.register(
      new Railroad(world.get(x, y), ruleRegistry)
    )
  );

  const cities = fixture.cities
    .filter(([x, y]) => cityRegistry.getByTile(world.get(x, y)) === null)
    .map(([x, y, owner, isCapital]): City => {
      if (!players.has(owner)) {
        players.set(owner, new Player(ruleRegistry));
      }

      const player = players.get(owner)!,
        city = new City(player, world.get(x, y), 'City', ruleRegistry);

      cityRegistry.register(city);

      if (isCapital) {
        capitals.set(player, city);
      }

      return city;
    });

  const network = new RouteNetwork({
      Road,
      Railroad,
      baseGrade: cityCountsAs(cityRegistry, RAILROAD),
      passable: notAnotherPlayersCity(cityRegistry),
      tileImprovementRegistry,
    }),
    capitalOf = (player: Player): City | null => capitals.get(player) ?? null,
    all = (): (Link | null)[] =>
      cities.map((city: City) => capitalLink(network, city, capitalOf)),
    eachFlooded = (): (Link | null)[] =>
      cities.map((city: City) => {
        network.invalidate();

        return capitalLink(network, city, capitalOf);
      }),
    time = (label: string, rounds: number, run: () => unknown): number => {
      const start = process.hrtime.bigint();

      for (let i = 0; i < rounds; i++) {
        run();
      }

      const perRound = Number(process.hrtime.bigint() - start) / 1e6 / rounds;

      console.log(
        `    ${label}: ${perRound.toFixed(3)} ms for ${cities.length} cities`
      );

      return perRound;
    };

  it('should log the cost of every city’s capital link', (): void => {
    const expected = eachFlooded();

    network.invalidate();
    expect(all()).to.deep.equal(expected);
    expect(all()).to.deep.equal(expected);

    const linked = expected.filter((link) => link !== null && link > 0).length;

    console.log(
      `    ${fixture.width} × ${fixture.height}, ${fixture.roads.length} road and ${fixture.railroads.length} railroad squares, ${cities.length} cities of ${players.size} players, ${linked} joined to their capital`
    );

    // Warm-up, then each in turn.
    for (let i = 0; i < 20; i++) {
      eachFlooded();
      network.invalidate();
      all();
    }

    time('a flood fill for each city', 50, eachFlooded);
    time('cold (invalidated, then every city)', 200, () => {
      network.invalidate();
      all();
    });
    time('warm (every city, labels kept)', 2000, all);
  });
});
