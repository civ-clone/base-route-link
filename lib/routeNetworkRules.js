"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeNetworkRules = exports.isRoute = void 0;
const Built_1 = require("@civ-clone/core-tile-improvement/Rules/Built");
const Captured_1 = require("@civ-clone/core-city/Rules/Captured");
const Created_1 = require("@civ-clone/core-city/Rules/Created");
const Destroyed_1 = require("@civ-clone/core-city/Rules/Destroyed");
const Criterion_1 = require("@civ-clone/core-rule/Criterion");
const Effect_1 = require("@civ-clone/core-rule/Effect");
const Pillaged_1 = require("@civ-clone/core-tile-improvement/Rules/Pillaged");
const Removed_1 = require("@civ-clone/core-tile-improvement/Rules/Removed");
/** A criterion: the tile improvement is one of `Routes`. */
const isRoute = (Routes) => (tile, tileImprovement) => Routes.some((Route) => tileImprovement instanceof Route);
exports.isRoute = isRoute;
/**
 * The rules that keep `network` up to date, by forgetting its labels (`RouteNetwork#invalidate`) when one of `Routes`
 *  (the road and railroad classes) is built, pillaged or removed, and when a city is founded, captured or destroyed.
 *  Ids are `<prefix>/built`, `/pillaged`, `/removed`, `/city-created`, `/city-captured` and `/city-destroyed`.
 *
 * Forgetting is cheap: the next query floods its component again.
 */
const routeNetworkRules = (prefix, network, Routes) => {
    const invalidate = new Effect_1.default(() => network.invalidate()), route = new Criterion_1.default((0, exports.isRoute)(Routes));
    return [
        new Built_1.default(`${prefix}/built`, route, invalidate),
        new Pillaged_1.default(`${prefix}/pillaged`, route, invalidate),
        new Removed_1.default(`${prefix}/removed`, route, invalidate),
        new Created_1.default(`${prefix}/city-created`, invalidate),
        new Captured_1.default(`${prefix}/city-captured`, invalidate),
        new Destroyed_1.default(`${prefix}/city-destroyed`, invalidate),
    ];
};
exports.routeNetworkRules = routeNetworkRules;
exports.default = exports.routeNetworkRules;
//# sourceMappingURL=routeNetworkRules.js.map