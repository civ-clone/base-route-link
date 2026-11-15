"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capitalLink = exports.notAnotherPlayersCity = exports.cityCountsAs = exports.RouteNetwork = exports.RAILROAD = exports.ROAD = exports.NONE = void 0;
const TileImprovementRegistry_1 = require("@civ-clone/core-tile-improvement/TileImprovementRegistry");
exports.NONE = 0;
exports.ROAD = 1;
exports.RAILROAD = 2;
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
class RouteNetwork {
    constructor({ Road, Railroad = null, baseGrade = () => exports.NONE, passable = () => true, tileImprovementRegistry = TileImprovementRegistry_1.instance, }) {
        this._byPlayer = new Map();
        this._Road = Road;
        this._Railroad = Railroad;
        this._baseGrade = baseGrade;
        this._passable = passable;
        this._tileImprovementRegistry = tileImprovementRegistry;
    }
    /** The square's own grade: railroad, road or none, from what's built on it and `baseGrade`. */
    grade(tile) {
        let grade = this._baseGrade(tile);
        if (grade === exports.RAILROAD) {
            return grade;
        }
        for (const tileImprovement of this._tileImprovementRegistry.getByTile(tile)) {
            if (this._Railroad !== null &&
                tileImprovement instanceof this._Railroad) {
                return exports.RAILROAD;
            }
            if (tileImprovement instanceof this._Road) {
                grade = exports.ROAD;
            }
        }
        return grade;
    }
    /** Forgets every label: the next query floods its component again. */
    invalidate() {
        this._byPlayer.clear();
    }
    /**
     * How well `from` and `to` are joined for `player`: `RAILROAD` when a chain of railroad squares joins them, else
     *  `ROAD` when a chain of road or railroad squares does, else `NONE`. The two squares are part of the chain, so each
     *  must be a road square itself (a city's square is, when `baseGrade` says so). A square is joined to itself by its
     *  own grade.
     */
    link(player, from, to) {
        if (!this.usable(from, player) || !this.usable(to, player)) {
            return exports.NONE;
        }
        const components = this.components(player), railroad = this.componentOf(components.railroad, exports.RAILROAD, from, player);
        if (railroad !== null &&
            railroad === this.componentOf(components.railroad, exports.RAILROAD, to, player)) {
            return exports.RAILROAD;
        }
        return this.componentOf(components.road, exports.ROAD, from, player) ===
            this.componentOf(components.road, exports.ROAD, to, player)
            ? exports.ROAD
            : exports.NONE;
    }
    /** Whether `from` and `to` are joined for `player` at all (`link` is `ROAD` or better). */
    connected(player, from, to) {
        return this.link(player, from, to) !== exports.NONE;
    }
    usable(tile, player) {
        return this.grade(tile) !== exports.NONE && this._passable(tile, player);
    }
    components(player) {
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
    componentOf(labels, minimum, tile, player) {
        const known = labels.get(tile);
        if (known !== undefined) {
            return known;
        }
        if (this.grade(tile) < minimum || !this._passable(tile, player)) {
            return null;
        }
        const components = this.components(player), label = components.next++, queue = [tile];
        labels.set(tile, label);
        // An index rather than `shift()`, which is linear.
        for (let i = 0; i < queue.length; i++) {
            for (const neighbour of queue[i].getNeighbours()) {
                if (neighbour === undefined ||
                    labels.has(neighbour) ||
                    this.grade(neighbour) < minimum ||
                    !this._passable(neighbour, player)) {
                    continue;
                }
                labels.set(neighbour, label);
                queue.push(neighbour);
            }
        }
        return label;
    }
}
exports.RouteNetwork = RouteNetwork;
/** A `baseGrade`: a square with a city on it counts as `grade` (a road, or a railroad). */
const cityCountsAs = (cityRegistry, grade = exports.ROAD) => (tile) => cityRegistry.getByTile(tile) === null ? exports.NONE : grade;
exports.cityCountsAs = cityCountsAs;
/** A `passable`: no city of another player's stands on the square. */
const notAnotherPlayersCity = (cityRegistry) => (tile, player) => {
    const city = cityRegistry.getByTile(tile);
    return city === null || city.player() === player;
};
exports.notAnotherPlayersCity = notAnotherPlayersCity;
/**
 * How well `city` is joined to its owner's capital (`capitalOf`), or `null` when its owner has none. The capital
 *  itself is joined to itself by its own square's grade.
 */
const capitalLink = (network, city, capitalOf) => {
    const player = city.player(), capital = capitalOf(player);
    if (capital === null) {
        return null;
    }
    return network.link(player, city.tile(), capital.tile());
};
exports.capitalLink = capitalLink;
exports.default = RouteNetwork;
//# sourceMappingURL=RouteNetwork.js.map