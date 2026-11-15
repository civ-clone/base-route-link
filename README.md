# base-route-link

Whether two squares are joined by an unbroken chain of road or railroad squares, for a player, and how well a city is
joined to its owner's capital. Cached per player, so asking for every city every turn costs a lookup each.

A library: no `main` and no `index`, so installing it registers nothing and changes no game. A rule set imports what it
needs from `lib/`.

## The network

```ts
import RouteNetwork, { capitalLink, cityCountsAs, notAnotherPlayersCity, RAILROAD } from '@civ-clone/base-route-link/lib/RouteNetwork';
import routeNetworkRules from '@civ-clone/base-route-link/lib/routeNetworkRules';

const network = new RouteNetwork({
  Road,
  Railroad,
  baseGrade: cityCountsAs(cityRegistry, RAILROAD),
  passable: notAnotherPlayersCity(cityRegistry),
  tileImprovementRegistry,
});

ruleRegistry.register(...routeNetworkRules('civ2-city:route-network', network, [Road, Railroad]));

network.link(player, from, to); // NONE (0), ROAD (1) or RAILROAD (2)
capitalLink(network, city, capitalOf); // the same for a city and its owner's capital, or null with no capital
```

- **`grade(tile)`** is a square's own grade: `RAILROAD` with a `Railroad`, else `ROAD` with a `Road`, else what
  `baseGrade` says. Subclasses count.
- **`link(player, from, to)`** is `RAILROAD` when a chain of railroad squares joins the two, else `ROAD` when a chain of
  road or railroad squares does, else `NONE`. A chain steps from a square to any of its neighbours (diagonals too, on
  a square grid). Both ends are part of it, so each must be a road square itself: a city's square is when `baseGrade`
  says so. A square is joined to itself by its own grade.
- **`connected(player, from, to)`** is `link(…) !== NONE`.
- **`passable(tile, player)`** says which squares a player's chain may use, the two ends included. Default: all of
  them. `notAnotherPlayersCity(cityRegistry)` keeps a chain out of other players' cities.
- **`baseGrade(tile)`** is how a city counts as a road. `cityCountsAs(cityRegistry, grade)` gives a city's square
  `grade`. Default: nothing counts.
- **`capitalLink(network, city, capitalOf)`** is `link` between the city and its owner's capital (`capitalOf(player)`),
  or `null` when the owner has none.

The road and railroad classes and both rules are the rule set's, so nothing here names a game's classes.

## Cost and invalidation

A flood fill for each city each time a city's yields are worked out would be far too slow. Instead each player's
network is split into connected components lazily: the first query touching a component floods it once and labels every
square in it, so every later query in it is a map lookup. One set of labels for road-or-railroad squares, one for
railroad squares.

The labels are kept until `invalidate()`. `routeNetworkRules(prefix, network, Routes)` gives the rules that call it:

| Id | Rule | When |
|---|---|---|
| `<prefix>/built` | `Built` (core-tile-improvement) | one of `Routes` is built |
| `<prefix>/pillaged` | `Pillaged` | one of `Routes` is pillaged |
| `<prefix>/removed` | `Removed` | one of `Routes` is removed |
| `<prefix>/city-created` | `Created` (core-city) | a city is founded |
| `<prefix>/city-captured` | `Captured` | a city changes hands |
| `<prefix>/city-destroyed` | `Destroyed` | a city is destroyed |

Other tile improvements built or removed don't invalidate anything. If `passable` or `baseGrade` reads anything else
(treaties, units), the rule set must call `invalidate()` when that changes. Units are left out on purpose: they move
all the time, so a unit test would make the labels useless.

Nothing is kept on a game entity, so nothing is saved, and a loaded game starts with no labels.

`npm run bench` times every city's capital link three ways: a flood fill for each city, cold (just invalidated), and
warm. `ROUTE_FIXTURE=<file.json>` runs it on a real map (see `bench/routeNetwork.ts` for the shape). Every city's link,
per pass:

| Map | Squares (road, railroad) | Cities (players) | Flood each | Cold | Warm |
|---|---|---|---|---|---|
| 104 × 65, a 368-turn game | 667, 284 | 91 (6) | 4.8 ms | 0.47 ms | 0.016 ms |
| 120 × 90, a 287-turn game | 1,431, 419 | 199 (9) | 13.9 ms | 1.05 ms | 0.042 ms |
| 120 × 90, synthetic: a road every 4 squares | 3,610, 860 | 200 (8) | 518 ms | 20.5 ms | 0.045 ms |

The two games are Civ1 saves on a square grid; the synthetic map is an upper bound.

## What Civilization II does

Civilization II's capital link (OpenCiv2 `city_calc_capital_link`, `src/auto/city.cpp`) is narrower than "any chain of
roads". `map_road_connection` (`src/auto/map.cpp`) runs the pathfinder with every step costing 1 whatever is built, so
it takes the shortest route over land, then walks that one route and fails at the first square without a road. It
answers 2 when every square it stepped on had a railroad, 1 when it reached the end, and 0 otherwise. On top of that:

- it gives up past a distance of 22 or after more than 50 steps, and when the two squares are on different land masses;
- it succeeds at the first city of the player's own that it reaches, not only at the target;
- a city of a player it has no alliance with stops it, and so does a unit of such a player (but not a barbarian's);
- two cities side by side get 2, as no square between them is checked;
- the capital itself gets 1, or 2 once its owner has the Railroad advance (the advance, not the squares);
- two cities with airports get 1, but only across land masses: on the same land mass the road answer replaces it.

Civilization II uses the link for shield waste only (`city_calc_shields_pollution`); trade corruption ignores it.
Waste is the corruption formula on shields less support (distance capped at 16), times (3 − link) / 3, divided by
`(government >> 1) + 1`, at most shields − support − 1 and at least 0. The link is worked out again with each city's
full recalculation (`city_recalc`).

`RouteNetwork` answers the general question instead: a winding road counts here, and doesn't in the original. A rule
set that needs the original's exact walk can still use `grade` square by square.
