import axios from 'axios';
import { itemGroupPaths, inStockListPaths, waitListPaths, imperialCookingListPaths } from '../../configs/dataConfig.json'
import { readFileSync, writeFileSync } from 'fs';
import { log } from '../utils/logUtils';
import { transform } from 'camaro';
import { BatchItemGroup } from '../models/BatchItemGroup';
import { parseApiResponse } from "../utils/parseUtils";
import { Item } from "../models/Item";
import { instanceToPlain, plainToInstance } from "class-transformer";
import { BatchItem } from "../models/BatchItem";
import { DiscordGroup } from '../models/DiscordGroup';
import { getConfigPath, getHomeFilePath, getXmlPath } from "../utils/commonUtils";
import moment from 'moment';
import { User } from '../models/User';

export var batchItemGroups: BatchItemGroup[];
export var inStockListGroups: BatchItemGroup[];
export var waitListGroups: BatchItemGroup[];
export var imperialCookingListGroups: BatchItemGroup[];
export var discordGroups: DiscordGroup[] = [];
export var registeredUsers: Map<string, User>;
export var itemIdAndbatchItemMap: Map<number, BatchItem>;

export const notifyGroups = {
    inStock: "inStock",
    waitList: "waitList"
}

export const registerItemGroupsMapping: { [key: string]: any } = {
    "預購" : { fileNames : ["waitList.xml"] },
    "黑星" : { fileNames : [ "mainHandBlackstar.xml", "awakBlackstar.xml", "offHandBlackstar.xml" ] },
    "主武黑星" : { fileNames : [ "mainHandBlackstar.xml" ] },
    "覺醒黑星" : { fileNames : [ "awakBlackstar.xml" ] },
    "覺武黑星" : { fileNames : [ "awakBlackstar.xml" ] },
    "覺武東黑星" : { fileNames : ["awakVBlackstar.xml"] },
    "副武黑星" : { fileNames : [ "offHandBlackstar.xml" ] },
}

const region = "tw";
const lang = "tw";
const marketUrl = `https://trade.${region}.playblackdesert.com`;
const marketDataHeader = {'Content-Type': 'application/json', 'User-Agent': 'BlackDesert'};
const subListUrl = `${marketUrl}/Trademarket/GetWorldMarketSubList`;
const arshaUrl = "https://api.arsha.io"
const homePath = "/../../";

export async function getBatchItemCopy(id: number|string, sids?: number[]|string[]): Promise<BatchItem> {
    let batchItemDummy = itemIdAndbatchItemMap.get(Number(id));

    if (batchItemDummy) {
        return batchItemDummy.createFromDummy(sids);
    }

    // TODO get name here
    let batchItem = new BatchItem(id, undefined, id.toString());

    itemIdAndbatchItemMap.set(Number(id), batchItem);

    return batchItem.createFromDummy(sids);
}

async function initItemDump() {
    let rawdata = readFileSync(__dirname + '/../../itemList.txt', {encoding: 'utf8'});
    let itemData = JSON.parse(rawdata);

    itemIdAndbatchItemMap = new Map<number, BatchItem>();

    for (let itemDumpEntry of itemData.itemList) {
        itemIdAndbatchItemMap.set(itemDumpEntry.id, new BatchItem(itemDumpEntry.id, [], itemDumpEntry.name))
    }

    log("Item list loaded, last update: " + (moment(itemData.updateTime).format('DD/MM HH:mm:ss')));
}

async function initItemGroups() {
    batchItemGroups = [];
    inStockListGroups = [];
    waitListGroups = [];
    imperialCookingListGroups = [];

    for (let filePath of itemGroupPaths) {
        try {
            let xmlString = readFileSync(getXmlPath(homePath, filePath), { encoding: 'utf8' });
            
            let data = await transform(xmlString, {
                items: [
                    '/items/item',
                    {
                        id: 'id',
                        sids: ['./sid', '.']
                    }
                ]
            });

            let promises = data.items.map((item: { id: number, sids: string[] }) => {
                return getBatchItemCopy(item.id, item.sids);
            });

            let batchItems = await Promise.all(promises);

            let batchItemGroup = new BatchItemGroup(filePath.split(".")[0], filePath, batchItems);
            batchItemGroups.push(batchItemGroup);

            log(`Item group ${filePath} loaded, loaded ${batchItemGroup.getItemCount()} items`);

            // in stock list
            if (inStockListPaths.includes(filePath)) {
                inStockListGroups.push(batchItemGroup);
                log(`In stock list item group appended with ${filePath}`);
            }

            // wait list
            if (waitListPaths.includes(filePath)) {
                 waitListGroups.push(batchItemGroup);
                log(`Wait list item group appended with ${filePath}`);
            }

            // imperial cooking list
            if (imperialCookingListPaths.includes(filePath)) {
                imperialCookingListGroups.push(batchItemGroup);
                log(`Imperial cooking list item group appended with ${filePath}`);
            }
        } catch (error) {
            log(`Failed to read file ${filePath}`);
            console.error(error);
        }
    }
};

function initWebhooks() {
    let fileContent = readFileSync(getConfigPath(homePath, "config.json"), { encoding: 'utf8' });
    let webhookUrls = JSON.parse(fileContent).webhookUrls;

    for (let webhookData of webhookUrls) {
        let discordGroup = new DiscordGroup(webhookData.channel, webhookData.url);
        let ignoreFiles: string[] = webhookData.ignoreFiles ?? [];
        
        // in stock list
        for (let itemGroup of inStockListGroups) {
            if (!ignoreFiles.includes(itemGroup.name) 
                && !ignoreFiles.includes(itemGroup.path))
            discordGroup.addSubscribedItemGroup(notifyGroups.inStock, itemGroup);
        }

        // wait list
        for (let itemGroup of waitListGroups) {
            if (!ignoreFiles.includes(itemGroup.name) 
                && !ignoreFiles.includes(itemGroup.path))
            discordGroup.addSubscribedItemGroup(notifyGroups.waitList, itemGroup);
        }
        
        discordGroups.push(discordGroup);
    }
}

async function initRegisteredUsers() {
    registeredUsers = new Map();

    try {
        let fileContent = readFileSync(getHomeFilePath(homePath, "users.json"), { encoding: 'utf8' });


        let userJsonData: Map<string, any> = JSON.parse(fileContent);

        let users = plainToInstance(User, Object.values(userJsonData));
        for (let user of users) {
            registeredUsers.set(user.userId, user);
        }
    } catch(error) {
        log("Failed to load users.");
        console.error(error);
    }
}

export async function initData() {
    await initItemDump();
    await initItemGroups();
    initWebhooks();
    initRegisteredUsers();

    
}

export async function getMarketItemSubList(batchItem: BatchItem, isInstockOnly: boolean = false): Promise<Item[]> {
    let config = {
        headers: marketDataHeader
    };

    let data = {
        mainKey: batchItem.id,
        keyType: 0
    };

    try {
        let response = await axios.post(subListUrl, data, config);
        let itemsJson = parseApiResponse(
            response.data.resultMsg, 
            ["id", "sid", "maxEnhance", "basePrice", "currentStock", "totalTrades", "priceMin", "priceMax", "lastSoldPrice", "lastSoldTime"],
            { name: batchItem.name });

        let items: Item[] = plainToInstance(Item, itemsJson);

        if (batchItem.itemMap.size > 0) {
            items = items.filter(item => {
                return batchItem.contains(item.sid);
            });
        }

        if (isInstockOnly) {
            items = items.filter(item => item.isInStock());
        }

        return items;
    } catch (error) {
        console.error(error);

        return [];
    }
}

export async function getMarketItemsSubLists(batchItems: BatchItem[], isInstockOnly: boolean = false): Promise<Item[]> {
    let promises = batchItems.map(batchItem => getMarketItemSubList(batchItem, isInstockOnly));

    let responseData: Item[][] = await Promise.all(promises);
    
    let items: Item[] = responseData.reduce((accumulator, value) => accumulator.concat(value), []);

    return items;
}

export async function getMarketWaitList(): Promise<Item[]> {
    let response = await axios.get(`${arshaUrl}/v2/${region}/GetWorldMarketWaitList?lang=${lang}`);
    let waitList: {}[] = !Array.isArray(response.data) ? [response.data] : response.data;

    let items: Item[] = plainToInstance(Item, waitList);

    return items;
} 

export function getItemGroups(groupName: string): BatchItemGroup[] {
    let result: BatchItemGroup[] = [];
    let registerItemGroups = registerItemGroupsMapping[groupName];
    
    for (let fileName of registerItemGroups?.fileNames ?? []) {
        let subscribedItemGroup = batchItemGroups.find(batchItemGroup => batchItemGroup.path === fileName);
        if (subscribedItemGroup) {
            result.push(subscribedItemGroup);
        }
    }

    return result;
}

export function getOrCreateUser(id: string, username?: string): User {
    if (!registeredUsers.has(id)) {
        let user = new User(id, username)
        registeredUsers.set(id, user);
        persistUsers();
    }

    return registeredUsers.get(id)!;
}

export function persistUsers() {
    writeFileSync(getHomeFilePath(homePath, "users.json"), JSON.stringify(instanceToPlain(registeredUsers)));
}