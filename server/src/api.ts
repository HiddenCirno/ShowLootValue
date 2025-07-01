import { inject, injectable } from "tsyringe";
import crypto from "crypto";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { ItemHelper } from "@spt/helpers/ItemHelper";
import { RagfairController } from "@spt/controllers/RagfairController";
import { RagfairOfferService } from "@spt/services/RagfairOfferService";

@injectable()
export class SLVAPI {



    constructor(
        @inject("WinstonLogger") protected logger: ILogger,
        @inject("RagfairOfferService") protected ragfairOfferService: RagfairOfferService,
        @inject("RagfairController") protected ragfairController: RagfairController,
        @inject("ItemHelper") protected itemHelper: ItemHelper,
        @inject("DatabaseServer") protected databaseServer: DatabaseServer,
    ) { }

    public debugActive = true;

    /**
     * 输出日志（青色）
     * @param message 
     */
    public log(message: string) {
        this.logger.logWithColor(message, LogTextColor.CYAN);
    }

    /**
     * 输出访问日志（绿色）
     * @param message 
     */
    public access(message: string) {
        this.logger.logWithColor(message, LogTextColor.GREEN);
    }

    /**
     * 输出错误日志（红色）
     * @param message 
     */
    public error(message: string) {
        this.logger.logWithColor(message, LogTextColor.RED);
    }

    /**
     * 输出警告日志（黄色）
     * @param message 
     */
    public warn(message: string) {
        this.logger.logWithColor(message, LogTextColor.YELLOW);
    }

    /**
     * 输出调试日志（灰色）
     * @param message 
     */
    public debug(message: string) {
        this.logger.logWithColor(message, LogTextColor.GRAY);
    }

    /**
    * 获取指定物品的估算价格
    * 来源优先级：跳蚤市场报价 > 价格表 > 手册价格
    * @param itemId 物品模板 ID
    * @returns number 估算价格（最低为0）
    */
    public getItemPrice(itemId: string): number {
        const clientDB = this.databaseServer.getTables();
        const priceTable = clientDB.templates.prices;
        const handbook = clientDB.templates.handbook.Items;

        // 优先获取跳蚤市场价格
        const ragfairPriceInfo = this.getAverageRagfairPrice(itemId);
        const ragfairPrice = this.ragfairController.getItemMinAvgMaxFleaPriceValues({templateId: itemId}).min;

        // 如果跳蚤价格有效，优先使用
        if (ragfairPrice > 0) {
            return ragfairPrice;
        }

        // 尝试获取内置价格表价格
        if (priceTable[itemId] > 0) {
            return priceTable[itemId];
        }

        // 如果手册中存在该物品，使用其价格
        const handbookItem = handbook.find(x => x.Id === itemId);
        if (handbookItem && handbookItem.Price > 0) {
            return Math.floor(handbookItem.Price * 0.6);
        }

        // 所有价格路径均无效，返回 0
        return 0;
    }

    /**
     * 获取指定物品在跳蚤市场的平均价格
     * 会自动过滤掉不可交易、质量不合格等无效报价
     * @param templateId 物品模板 ID
     * @returns { itemID: string, Price: number } 报价信息（价格为0表示无有效报价）
     */
    public getAverageRagfairPrice(templateId: string): { itemID: string, Price: number } {
        // 获取所有与该模板 ID 对应的跳蚤市场报价
        let offers = this.ragfairOfferService.getOffersOfType(templateId);

        if (!offers || offers.length === 0) {
            return { itemID: templateId, Price: 0 };
        }

        // 过滤报价：
        // - 排除系统商人(memberType == 4)
        // - 仅保留用卢布(RUB)交易的报价
        // - 要求物品质量为 1（未损坏）
        // - 如果为套装，需允许分开出售
        offers = offers.filter(offer =>
            offer.user.memberType !== 4 &&
            offer.requirements[0]._tpl === "5449016a4bdc2d6f028b456f" && // 卢布
            this.itemHelper.getItemQualityModifier(offer.items[0]) === 1 &&
            (offer.items.length > 1 || !offer.sellInOnePiece)
        );

        if (!offers || offers.length === 0) {
            return { itemID: templateId, Price: 0 };
        }

        // 计算有效报价的平均价格
        //const totalCost = offers.reduce((sum, offer) => sum + offer.summaryCost, 0);
        //const averageCost = totalCost / offers.length;
        const lowestCost = Math.min(...offers.map(offer => offer.summaryCost));

        return {
            itemID: templateId,
            Price: Math.floor(lowestCost)
        };
    }

}

// 类型定义：嵌套对象，支持任意key和任意深度
export type NestedObject = { [key: string]: any };
