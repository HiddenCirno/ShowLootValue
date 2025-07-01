import { DependencyContainer, Lifecycle } from "tsyringe";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import type { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { ImporterUtil } from "@spt/utils/ImporterUtil"
import { SLVAPI } from "./api";
//
class Mod implements IPreSptLoadMod {
    private static container: DependencyContainer;
    public preSptLoad(container: DependencyContainer): void {
        Mod.container = container;
        container.register<SLVAPI>("SLVAPI", SLVAPI, { lifecycle: Lifecycle.Singleton });
        const staticRouterModService = container.resolve<StaticRouterModService>("StaticRouterModService");
        const slvAPI = container.resolve<SLVAPI>("SLVAPI")
        staticRouterModService.registerStaticRouter(
            "SLVRoutes",
            [
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
    public postSptLoad(container: DependencyContainer): void {
        //
    }
    public postDBLoad(container: DependencyContainer): void {
        //dfAPI.loadItem(ItemFile)

    }
    public returnPriceMap(request) {
        const databaseServer = Mod.container.resolve<DatabaseServer>("DatabaseServer");
        const importerUtil = Mod.container.resolve<ImporterUtil>("ImporterUtil")
        const clientDB = databaseServer.getTables();
        const slvAPI = Mod.container.resolve<SLVAPI>("SLVAPI")
        const Result = {}
        const clientItem = clientDB.templates.items
        for(let i in clientItem){
            const item = clientItem[i]
            const itemid = item._id
            const price = slvAPI.getItemPrice(itemid)
            if(price > 0){
                Result[itemid] = price
            }
        }

        //vulcanAPI.writeFile(`${ModConfig.Global.ModPath}ItemNameData.json`, JSON.stringify(Result, null, 4));
        return Result
    }
}
module.exports = { mod: new Mod() }