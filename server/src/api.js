"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLVAPI = void 0;
const tsyringe_1 = require("C:/snapshot/project/node_modules/tsyringe");
const ILogger_1 = require("C:/snapshot/project/obj/models/spt/utils/ILogger");
const LogTextColor_1 = require("C:/snapshot/project/obj/models/spt/logging/LogTextColor");
const DatabaseServer_1 = require("C:/snapshot/project/obj/servers/DatabaseServer");
const ItemHelper_1 = require("C:/snapshot/project/obj/helpers/ItemHelper");
const RagfairController_1 = require("C:/snapshot/project/obj/controllers/RagfairController");
const RagfairOfferService_1 = require("C:/snapshot/project/obj/services/RagfairOfferService");
let SLVAPI = class SLVAPI {
    logger;
    ragfairOfferService;
    ragfairController;
    itemHelper;
    databaseServer;
    constructor(logger, ragfairOfferService, ragfairController, itemHelper, databaseServer) {
        this.logger = logger;
        this.ragfairOfferService = ragfairOfferService;
        this.ragfairController = ragfairController;
        this.itemHelper = itemHelper;
        this.databaseServer = databaseServer;
    }
    debugActive = true;
    /**
     * 输出日志（青色）
     * @param message
     */
    log(message) {
        this.logger.logWithColor(message, LogTextColor_1.LogTextColor.CYAN);
    }
    /**
     * 输出访问日志（绿色）
     * @param message
     */
    access(message) {
        this.logger.logWithColor(message, LogTextColor_1.LogTextColor.GREEN);
    }
    /**
     * 输出错误日志（红色）
     * @param message
     */
    error(message) {
        this.logger.logWithColor(message, LogTextColor_1.LogTextColor.RED);
    }
    /**
     * 输出警告日志（黄色）
     * @param message
     */
    warn(message) {
        this.logger.logWithColor(message, LogTextColor_1.LogTextColor.YELLOW);
    }
    /**
     * 输出调试日志（灰色）
     * @param message
     */
    debug(message) {
        this.logger.logWithColor(message, LogTextColor_1.LogTextColor.GRAY);
    }
    /**
    * 获取指定物品的估算价格
    * 来源优先级：跳蚤市场报价 > 价格表 > 手册价格
    * @param itemId 物品模板 ID
    * @returns number 估算价格（最低为0）
    */
    getItemPrice(itemId) {
        const clientDB = this.databaseServer.getTables();
        const priceTable = clientDB.templates.prices;
        const handbook = clientDB.templates.handbook.Items;
        // 优先获取跳蚤市场价格
        const ragfairPriceInfo = this.getAverageRagfairPrice(itemId);
        const ragfairPrice = this.ragfairController.getItemMinAvgMaxFleaPriceValues({ templateId: itemId }).min;
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
    getAverageRagfairPrice(templateId) {
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
        offers = offers.filter(offer => offer.user.memberType !== 4 &&
            offer.requirements[0]._tpl === "5449016a4bdc2d6f028b456f" && // 卢布
            this.itemHelper.getItemQualityModifier(offer.items[0]) === 1 &&
            (offer.items.length > 1 || !offer.sellInOnePiece));
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
};
exports.SLVAPI = SLVAPI;
exports.SLVAPI = SLVAPI = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)("WinstonLogger")),
    __param(1, (0, tsyringe_1.inject)("RagfairOfferService")),
    __param(2, (0, tsyringe_1.inject)("RagfairController")),
    __param(3, (0, tsyringe_1.inject)("ItemHelper")),
    __param(4, (0, tsyringe_1.inject)("DatabaseServer")),
    __metadata("design:paramtypes", [typeof (_a = typeof ILogger_1.ILogger !== "undefined" && ILogger_1.ILogger) === "function" ? _a : Object, typeof (_b = typeof RagfairOfferService_1.RagfairOfferService !== "undefined" && RagfairOfferService_1.RagfairOfferService) === "function" ? _b : Object, typeof (_c = typeof RagfairController_1.RagfairController !== "undefined" && RagfairController_1.RagfairController) === "function" ? _c : Object, typeof (_d = typeof ItemHelper_1.ItemHelper !== "undefined" && ItemHelper_1.ItemHelper) === "function" ? _d : Object, typeof (_e = typeof DatabaseServer_1.DatabaseServer !== "undefined" && DatabaseServer_1.DatabaseServer) === "function" ? _e : Object])
], SLVAPI);
//# sourceMappingURL=api.js.map