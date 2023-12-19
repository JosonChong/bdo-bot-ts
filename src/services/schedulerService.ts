import schedule from 'node-schedule';
import * as dataService from './dataService';
import { BatchItem } from '../models/BatchItem';
import { log } from '../utils/logUtils';
import { WebhookMessage } from '../models/BotMessage';
import NodeCache from 'node-cache';
import { User } from '../models/User';
import moment from 'moment';

const cacheTimeInSecond = 30 * 60;
let inStockListCache: NodeCache;
let waitListCache: NodeCache;

export function initCache() {
    inStockListCache = new NodeCache();
    waitListCache = new NodeCache();
}

export function startCheckInStockJob() {
    let job = schedule.scheduleJob('*/30 * * * * *', async function() {
        try {
            let batchItems = dataService.inStockListGroups.reduce(
                (accumulator, inStockListGroup) => [...accumulator, ...inStockListGroup.batchItems], [] as BatchItem[]);
    
            let items = await dataService.getMarketItemsSubLists(batchItems, true);

            items = items.filter(item => {
                let cacheKey = `${item.id}_${item.sid}`;
                let itemCached = inStockListCache.has(cacheKey);

                // add to cache or update the ttl if item already exist
                inStockListCache.set(cacheKey, true, cacheTimeInSecond);
                
                return !itemCached;
            });

            let subscribedDiscordGroups = dataService.discordGroups.filter(
                discordGroup => discordGroup.isSubscribedItems(
                    dataService.notifyGroups.inStock, items));

            for (let discordGroup of subscribedDiscordGroups) {
                let botMessage = new WebhookMessage(discordGroup);
                botMessage.addText("物品上架");
    
                let table = botMessage.addTable(["道具", "強化等級", "數量"]);
                let subscribedItems = discordGroup.getSubscribedItems(
                    dataService.notifyGroups.inStock, items);
                for (let subscribedItem of subscribedItems) {
                    table.addContentRow([subscribedItem.name!, subscribedItem.getSidFullName(), subscribedItem.currentStock!.toString()])
                }

                let subscribedUsers: User[] = Array.from(dataService.registeredUsers.values()).filter(
                    user => items.some(item => user.isSubscribedItem(discordGroup, item, dataService.notifyGroups.inStock)))
                
                botMessage.addUserTags(subscribedUsers);

                botMessage.send();
            }
        } catch (error) {
            log("Check InStockJob Exception");
        }
    });

    return job;
}

export function startCheckWaitListJob() {
    let job = schedule.scheduleJob('*/30 * * * * *', async function() {
        try {
            let items = await dataService.getMarketWaitList();

            let batchItems = dataService.waitListGroups.reduce(
                (accumulator, waitListGroup) => [...accumulator, ...waitListGroup.batchItems], [] as BatchItem[]);
    
            items = items.filter(item => {
                let cacheKey = `${item.id}_${item.sid}_${item.liveAt}`;
                let itemCached = waitListCache.has(cacheKey);

                let isInList = batchItems.some(batchItem => batchItem.containsItem(item));

                // add to cache or update the ttl if item already exist
                waitListCache.set(cacheKey, true, cacheTimeInSecond);
                
                return isInList && !itemCached;
            });

            let subscribedDiscordGroups = dataService.discordGroups.filter(
                discordGroup => discordGroup.isSubscribedItems(
                    dataService.notifyGroups.waitList, items));

            for (let discordGroup of subscribedDiscordGroups) {
                let botMessage = new WebhookMessage(discordGroup);

                let subscribedItems = discordGroup.getSubscribedItems(
                    dataService.notifyGroups.waitList, items);

                for (let subscribedItem of subscribedItems) {
                    let blockContent = botMessage.addBlock([`等待交易登記: 　　${subscribedItem.name!}`]);
                    blockContent.addContent(`強化等級:　　　　 ${subscribedItem.getSidFullName()}`);
                    blockContent.addContent(`價錢:　　　　　　 ${subscribedItem.price!.toLocaleString()}`);
                    blockContent.addContent(`上架時間:　　　　 ${moment(subscribedItem.liveAt!).format('HH:mm:ss')}`);
                }

                let subscribedUsers: User[] = Array.from(dataService.registeredUsers.values()).filter(
                    user => items.some(item => user.isSubscribedItem(discordGroup, item, dataService.notifyGroups.waitList)))
                
                botMessage.addUserTags(subscribedUsers);

                botMessage.send();
            }
        } catch (error) {
            log("Check WaitListJob Exception");
        }
    });

    return job;
}