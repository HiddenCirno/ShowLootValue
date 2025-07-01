"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tsyringe_1 = require("C:/snapshot/project/node_modules/tsyringe");
const api_1 = require("./api");
//
class Mod {
    static container;
    preSptLoad(container) {
        Mod.container = container;
        container.register("SLVAPI", api_1.SLVAPI, { lifecycle: tsyringe_1.Lifecycle.Singleton });
        const staticRouterModService = container.resolve("StaticRouterModService");
        const slvAPI = container.resolve("SLVAPI");
        staticRouterModService.registerStaticRouter("SLVRoutes", [
            {
                url: "/ShowLootValue/pullPriceMap",
                action: (url, info, sessionId, output) => {
                    //info is the payload from client in json
                    //output is the response back to client
                    return (JSON.stringify(this.returnPriceMap(info.request)));
                }
            }
        ], "custom-dynamic-SLVRoutes");
    }
    postSptLoad(container) {
        //
    }
    postDBLoad(container) {
        //dfAPI.loadItem(ItemFile)
    }
    returnPriceMap(request) {
        const databaseServer = Mod.container.resolve("DatabaseServer");
        const importerUtil = Mod.container.resolve("ImporterUtil");
        const clientDB = databaseServer.getTables();
        const slvAPI = Mod.container.resolve("SLVAPI");
        const Result = {};
        const clientItem = clientDB.templates.items;
        for (let i in clientItem) {
            const item = clientItem[i];
            const itemid = item._id;
            const price = slvAPI.getItemPrice(itemid);
            if (price > 0) {
                Result[itemid] = price;
            }
        }
        //vulcanAPI.writeFile(`${ModConfig.Global.ModPath}ItemNameData.json`, JSON.stringify(Result, null, 4));
        return Result;
    }
}
module.exports = { mod: new Mod() };
//# sourceMappingURL=mod.js.map