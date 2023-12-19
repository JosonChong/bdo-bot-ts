const { Client, GatewayIntentBits, Partials, WebhookClient } = require('discord.js');
const dataService = require('../dataService.js');
const dataServiceNew = require('./services/dataService.ts');
const tradeService = require('../tradeService.js');
const schedule = require('node-schedule');
const { log } = require('./utils/logUtils.ts');
const discordUtils = require('./utils/discordUtils.ts');
const { discordToken, webhookUrls } = require('../config.json');
const { dataPath, inStockListPaths, waitListPaths, itemGroupPaths } = require('../dataConfig.json');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { transform } = require('camaro');
const dns = require('node:dns');
const { PersonalMessage, BotMessage, WebhookMessage } = require('./models/BotMessage.ts');
const { BatchItem } = require('./models/BatchItem.ts');
const { BatchItemGroup } = require('./models/BatchItemGroup.ts');
const { DiscordGroup } = require('./models/DiscordGroup.ts');

dns.setDefaultResultOrder("ipv4first");

const client = new Client({
    'intents': [
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    'partials': [Partials.Channel]
  });

const PREFIX = "!";
const searchLimit = 20;
const cacheTimeInSecond = 30 * 60;
const defaultRetries = 1;

const imperialItemAount = 40000;
const imperialItemLimit = 1000;

const tokenHelpText = "Please submit your token first by entering !token <you token here>\nTo get your token, go to https://trade.tw.playblackdesert.com/Home/list/hot and copy the TradeAuth_Session cookie in the request";

const commandJson = {
    "search" : { function : searchItem, commandLengthes : [2], helpText : null },
    "checkBS" : { function : checkBS, helpText : null },
    "updateDB" : { function : updateDB, helpText : null },
    "register" : { function : registerItemNotification, commandLengthes : [3], helpText : "Usage: !register [群組] [裝備組別/ID]" },
    "subscribe" : { function : registerItemNotification, commandLengthes : [3], helpText : "Usage: !register [群組] [裝備組別/ID]" },
    "unsubscribe" : { function : unsubscribeItemNotification, commandLengthes : [2], helpText : "Usage: !unsubscribe [裝備組別/ID]" },
    "imperial" : { function : checkImperial, helpText : null },
    "buyImperial" : { function : buyImperial, commandLengthes : [3] },
    "token" : { function : setToken, dmOnly : true, commandLengthes : [2], helpText : tokenHelpText, isAsync: true },
    "buy" : { function : buyItem, dmOnly : true, commandLengthes : [5, 6, 7, 8], helpText : "Usage: !buy [裝備ID] [SID] [價格] [數量] [一次購買最大數量] [buyChooseKey] [retryBiddingNo]" },
    "setAction" : { function : setAction, commandLengthes : [3, 4], helpText : "Usage: " },
    "checkBidding" : { function : checkBidding, commandLengthes : [1], isAsync: true },
    "rebuy" : { function : rebuy, commandLengthes : [1], isAsync: true },
    "account" : { function : setAccount, commandLengthes : [4] },

    "test" : { function : test, isAsync: true, helpText : "" },
}
let commandMap = new Map(Object.entries(commandJson));

// let itemGroupMap = new Map();
let batchItemGroups = [];
let waitListGroups = [];
let inStockListGroups = [];

// TODO move to XML
const registerItemGroupsMapping = {
    "預購" : { fileNames : ["waitList.xml"] },
    "黑星" : { fileNames : [ "mainHandBlackstar.xml", "awakBlackstar.xml", "offHandBlackstar.xml" ] },
    "主武黑星" : { fileNames : [ "mainHandBlackstar.xml" ] },
    "覺醒黑星" : { fileNames : [ "awakBlackstar.xml" ] },
    "覺武黑星" : { fileNames : [ "awakBlackstar.xml" ] },
    "覺武東黑星" : { fileNames : ["awakVBlackstar.xml"] },
    "副武黑星" : { fileNames : [ "offHandBlackstar.xml" ] },
}

let waitList = [];
let inStockList = [];
let fileList = [];

let notifiedInStockList = [];
let currentWaitList = [];
let imperialCookingMap = new Map();
let webhooks = [];

let users;
try {
    users = new Map(Object.entries(require('../users.json')));
} catch (ignored) {
    users = new Map();
}

const loadItemGroups = async () => {
    itemGroupPaths.forEach((filePath, key, arr) => {
        fs.readFile(path.join(__dirname, dataPath, filePath), 'utf8', (err, xmlString) => {
            if (err) {
                log(`Failed to read file ${filePath}`);
            }
            
            transform(xmlString, {
                items: [
                    '/items/item',
                    {
                        id: 'id',
                        sids: ['./sid', '.']
                    }
                ]}).then(data => {
                let batchItems = data.items.map(item => new BatchItem(item.id, item.sids));
                 let batchItemGroup = new BatchItemGroup(filePath.split(".")[0], filePath, batchItems);
                    
                 batchItemGroups.push(batchItemGroup);

                log(`Item group ${filePath} loaded, loaded ${batchItemGroup.getItemCount()} items`);

                if (inStockListPaths.includes(filePath)) {
                    inStockListGroups.push(batchItemGroup);
                    log(`In stock list item group appended with item group ${filePath}`);
                }

                if (waitListPaths.includes(filePath)) {
                    waitListGroups.push(batchItemGroup);
                    log(`Wait list item group appended with item group ${filePath}`);
                }
            });
        });
      });
  };

loadItemGroups();

// TODO
const loadImperialCookingList = async () => {
        fs.readFile(path.join(__dirname, dataPath, 'imperialCooking.xml'), 'utf8', (err, xmlString) => {
            if (err) {
                log(`Failed to read file ${filePath}`);
            }
            
            let imperialCookingList = [];
            transform(xmlString, {
                items: [
                    '/items/item',
                    {
                        id: 'id',
                        name: 'name',
                        quantity: 'quantity',
                        sids: ['./sid', '.']
                    }
                ]})
                .then(data => {
                    imperialCookingList = data.items;

                    for (item of imperialCookingList) {
                        imperialCookingMap.set(parseInt(item.id), item)
                    }

                    log(`Imperial cooking list loaded, loaded ${imperialCookingMap.size} items`);
                });
        })
  };

loadImperialCookingList();

client.on('ready', () => {
    log(`Logged in as ${client.user.tag}!`);
    dataService.initDB();

    initWebhooks();
});

function searchItem(msg, commands, botMessage) {
    let result = dataService.searchItem(commands[1]);

    let table = botMessage.addTable(["ID", "物品名稱"]);
    let count = 0;
    for (let i in result) {
        if (count < searchLimit) {
            table.addContentRow([result[i].id, result[i].name]);
        }

        count++;
    }
    
    botMessage.send();
}

function checkBS(msg) {
    dataService.checkStock(inStockList)
        .then(result => {
            let replyText = "";
            if (result.length > 0) {
                for (let i in result) {
                    let name = `${result[i].name}`;
                    replyText += name.padEnd(20, '　') + "current stock: " + result[i].currentStock + "\n";
                }
            } else {
                replyText = "no stock";
            }
            msg.reply(replyText);
        });
}

function updateDB() {
    dataService.updateDB();
}

// e.g. !register sav 11653
//      !register sav 預購
//      !register sav 覺醒黑星 
function registerItemNotification(msg, commands) {
    if (!webhooks.some(webhook => webhook.channel === commands[1])) {
        msg.reply(`Channel ${commands[1]} doesn't exist`);
        return false;
    }

    let user = getOrCreateUser(msg.author.id);

    if (!user.hasOwnProperty("channels")) {
        user.channels = { [commands[1]] : {} };
    } else if (!user.channels[commands[1]]) {
        user.channels[commands[1]] = {};
    }
    channel = user.channels[commands[1]];

    if (parseInt(commands[2]) != commands[2]) {
        if (!registerItemGroupsMapping[commands[2]]) {
            msg.reply(`Item group ${commands[2]} is not in our list, request admin to add the item group`);
            return false;
        }

        if (channel.hasOwnProperty("notifyItemGroups")) {
            if (channel.notifyItemGroups.includes(commands[2])) {
                msg.reply(`Item group ${commands[2]} is already registered`);
                return true;
            }

            channel.notifyItemGroups.push(commands[2]);
        } else {
            channel.notifyItemGroups = [commands[2]];
        }
    } else {
        // register list is not exist, check if commands[2] is item id
        let id = parseInt(commands[2]);
        if (!id) {
            msg.reply(`Invalid item id`);
            return false;
        }

        if (!waitList.some(item => item.id == id) && !inStockList.some(item => item.id == id)) {
            msg.reply(`Item ${id} is not in our list, request admin to add the item`);
            return false;
        }

        if (channel.hasOwnProperty("notifyItemIds")) {
            if (channel.notifyItemIds.includes(id)) {
                msg.reply(`Item ${id} is already registered`);
                return true;
            }

            channel.notifyItemIds.push(id);
        } else {
            channel.notifyItemIds = [id];
        }
    }

    dataService.persistUsers(users);
}

function unsubscribeItemNotification(msg, commands) {
    let user = getOrCreateUser(msg.author.id);

    if (!user.channels) {
        return false;
    }

    if (parseInt(commands[1]) != commands[1]) {
        if (!registerItemGroupsMapping[commands[1]]) {
            msg.reply(`Item group ${commands[1]} is not in our list, request admin to add the item group`);
            return false;
        }

        Object.values(user.channels).forEach(channel => {
            if (channel.notifyItemGroups) {
                channel.notifyItemGroups = channel.notifyItemGroups.filter(
                    groupName => groupName != commands[1]);
            }
        });
    } else {
        let id = parseInt(commands[1]);
        if (!id) {
            msg.reply(`Invalid item id`);
            return false;
        }

        Object.values(user.channels).forEach(channel => {
            if (channel.notifyItemIds) {
                channel.notifyItemIds = channel.notifyItemIds.filter(
                    itemId => itemId != id);
            }
        });
    }

    dataService.persistUsers(users);

    return true;
}

async function getImperialBuyOrder() {
    let data = await dataService.getPriceData(Array.from(imperialCookingMap.values()), true);

    let buyOrder = [];
    data.forEach((value, key) => {
        let item = value[0];

        let imperialpackage = imperialCookingMap.get(key);
        item.id = key;
        item.quantity = parseInt(paimperialpackageckage.quantity);
        item.name = imperialpackage.name;

        item.totalBuyPrice = item.buyPrice * item.quantity;

        buyOrder.push(item);
      });

    buyOrder.sort((a, b) => a.totalBuyPrice - b.totalBuyPrice);

    return buyOrder;
}

function checkImperial(msg) {
    getImperialBuyOrder().then(buyOrder => {
        let replyMessage = '';
        for (item of buyOrder.slice(0, 5)) {
            replyMessage += `${item.name.padEnd(11, '　')} ID: ${item.id.toString().padEnd(6, ' ')} 單個價錢: ${item.buyPrice.toString().padEnd(7, ' ')} 每箱價錢: ${item.totalBuyPrice}\n`
            replyMessage += `!buy ${item.id} 0 ${item.buyPrice} ${imperialItemAount} ${imperialItemLimit}\n`
        }

        msg.reply(discordUtils.formatBlock(replyMessage));
    });
}

function getImperialReplyMessage(buyOrder, currentPrice) {
    let message = `${currentPrice ? `正在購買，目前每箱價格 ${currentPrice}\n` : "購買完成，"}已購買:`;

    buyOrder.forEach(item => {
        if (item.fulfilledAmount && item.fulfilledAmount > 0) {
            let boxes = Math.floor(item.fulfilledAmount / item.quantity);
            message += "\n";
            message += `${item.name.padEnd(11, '　')} ${(item.fulfilledAmount + "件").padEnd(8, ' ')} ${boxes}箱`
        }
    });

    return message;
}

async function buyImperial(msg, commands) {
    let user = users.get(msg.author.id);
    if (!user?.token || commands.length < 3) {
        return msg.reply("Please submit your token first by entering !token <you token here>\nTo get your token, go to https://trade.tw.playblackdesert.com/Home/list/hot and copy the TradeAuth_Session cookie in the request");
    }
    
    // Amount of boxes
    let boxesAmount = commands[1];
    // maxPrice of a box
    let maxPrice = commands[2];

    let replyMsg = await msg.reply("Now trading...");
    let buyOrder = await getImperialBuyOrder();

    let boxesLeft = boxesAmount;
    let currentTotalBuyPrice = buyOrder[0].totalBuyPrice;

    while (boxesLeft > 0 && currentTotalBuyPrice <= maxPrice) {
        for (let item of buyOrder) {
            if (item.totalBuyPrice <= currentTotalBuyPrice) {
                let totalQuantity = boxesLeft * item.quantity;
                for (let i = 0; i < totalQuantity / imperialItemLimit; i++) {
                    let buyResult = await tradeService.buyItem(user.token, item.id, item.sid, item.buyPrice, 
                        totalQuantity > imperialItemLimit ? imperialItemLimit : totalQuantity);
                    if (!buyResult.success) {
                        item.buyPrice += 100;
                        item.totalBuyPrice = item.buyPrice * item.quantity;
                        break;
                    }
                    
                    if (!item.fulfilledAmount) {
                        item.fulfilledAmount = 0;
                    }
                    item.fulfilledAmount += buyResult.fulfilledAmount;

                    boxesLeft -= buyResult.fulfilledAmount / item.quantity;
                    replyMsg.edit(getImperialReplyMessage(buyOrder, currentTotalBuyPrice));
                }
            }
        }

        currentTotalBuyPrice += 100;
    }

    replyMsg.edit(getImperialReplyMessage(buyOrder));
}

async function setToken(msg, commands) {
    let input = commands[1];
    let user = getOrCreateUser(msg.author.id, msg.author.username);

    if (input === "auto") {
        await refreshToken(user);
    } else {
        user.token = input;
        dataService.persistUsers(users);
    }

    return true;
}

function buyItem(msg, commands) {
    let user = getOrCreateUser(msg.author.id);
    if (user?.token) {
        let itemId = commands[1];
        let itemSid = commands[2];
        let price = commands[3]
        let amount = commands[4];
        let limit = commands[5] ?? amount;
        let buyChooseKey = commands[6];
        let retryBiddingNo = commands[7];

        msg.reply("Now trading...").then(replyMsg => {
            let amountLeft = amount;
            (async () => {
                for (let i = 0; i < amount / limit; i++) {
                    let result = await tradeService.buyItem(user.token, itemId, itemSid, price, amountLeft > limit ? limit : amountLeft, buyChooseKey, retryBiddingNo);
                    if (!result.success) {
                        replyMsg.edit(`Fulfilled ${amount - amountLeft}/${amount}, end reason: ${result.reason}`);
                        break;
                    } else {
                        amountLeft -= result.fulfilledAmount;

                        if (amountLeft === 0) {
                            replyMsg.edit("Success");
                        } else {
                            replyMsg.edit(`Fulfilled ${amount - amountLeft}/${amount}, still trading...`);
                        }
                    }
                }
            })();
        });
    } else {
        msg.reply("Please submit your token first by entering !token <you token here>\nTo get your token, go to https://trade.tw.playblackdesert.com/Home/list/hot and copy the TradeAuth_Session cookie in the request");
    }
}

const validSetCommands = ["rebuy"];

function isItemId(input) {
    return parseInt(input) == input;
}

function isValidSubId(itemId, subId) {
    return subId && subId >= 0 && subId <= 20;
}

function addItemInSetCommand(user, setCommand, items) {
    if (!user.hasOwnProperty(setCommand)) {
        user[setCommand] = {};
    }

    for (let item of items) {
        if (!user[setCommand][item.id]) {
            user[setCommand][item.id] = [];
        }
    
        for (let sid of item.sids.map(sid => parseInt(sid))) {
            if (user[setCommand][item.id].indexOf(sid)==-1) {
                user[setCommand][item.id].push(sid)
            }
        }
    }
}

function setAction(msg, commands) {
    let user = getOrCreateUser(msg.author.id);

    let setCommand = commands[1];
    let itemGroupOrId = commands[2];
    let subId = commands[3];

    if (!validSetCommands.includes(setCommand)) {
        return false;
    }

    let items = [];
    if (isItemId(itemGroupOrId)) {
        if (!isValidSubId(itemGroupOrId, subId)) {
            return false;            
        }

        items.push({id : itemGroupOrId, sids: [subId]});
    } else {
        let itemsToAdd = itemGroupMap.get(itemGroupOrId);
        if (itemsToAdd) {
            items.push(... itemsToAdd);
        }
    }

    addItemInSetCommand(user, setCommand, items);

    dataService.persistUsers(users);
}

async function getBidding(user, retries, botMessage) {
    let data = await tradeService.getBiddingList(user.token);
    if (!data.success) {
        if (retries && data.reason.invalidToken) {
            let text = botMessage.addText("Existing token is invalid, trying to refresh token...");
            botMessage.send();
            log(`Existing token is invalid, trying to refresh token for ${discordUtils.getUserDisplayName(user)}`);

            let refreshTokenSuccess = await refreshToken(user);

            if (!refreshTokenSuccess) {
                text.edit("Existing token is invalid, failed to refresh.");
                botMessage.send();
                return false;
            }

            text.edit("Token saved in the system was invalid, refreshed successfully.");
            botMessage.send();

            return await getBidding(user, retries - 1, botMessage);
        }

        return false;
    }

    return data.buyList;
} 

async function checkBidding(msg, commands, botMessage) {
    let user = users.get(msg.author.id);
    let buyList = await getBidding(user, defaultRetries, botMessage);

    if (!buyList) {
        return false;
    }

    let table = botMessage.addTable(["物品名稱", "已購買", "剩餘預購"]);
    for (let item of buyList) {
        table.addContentRow([item.name, item.boughtCount, item.leftCount]);
    }

    await botMessage.send();
    return true;
}

async function rebuy(msg, commands, botMessage) {
    let user = users.get(msg.author.id);
    let buyList = await getBidding(user, defaultRetries, botMessage);

    if (!buyList) {
        return false;
    }

    let rebuyItems = buyList.filter(item => {
        if (user.rebuy 
            && user.rebuy[item.mainKey] 
            && user.rebuy[item.mainKey].includes(item.subKey)
            && item.boughtCount > 0) {
                return true;
            }

        return false;
    });

    if (rebuyItems.length <= 0) {
        botMessage.addText("Nothing to rebuy.");
        botMessage.send();
        return true;
    }

    let table = botMessage.addTable(["道具", "階級" ,"成功購買", "重新預購", "價格"])
    for (let rebuyItem of rebuyItems) {
        let result = await tradeService.buyItem(user.token, rebuyItem.mainKey, rebuyItem.subKey, rebuyItem.pricePerOne, 
            rebuyItem.leftCount + rebuyItem.boughtCount, rebuyItem.chooseKey, rebuyItem.buyNo);

        table.addContentRow([dataService.getItem(rebuyItem.mainKey).name, rebuyItem.subKey, 
            rebuyItem.boughtCount, result.reservedAmount, rebuyItem.pricePerOne]);
    }

    botMessage.send();
}

function setAccount(msg, commands) {
    let user = getOrCreateUser(msg.author.id);
    let email = commands[1];
    let password = commands[2];
    let secondaryPassword = commands[3];

    user.encryptedEmail = tradeService.encrypt(email);
    user.encryptedPassword = tradeService.encrypt(password);
    user.encryptedSecondaryPassword = tradeService.encrypt(secondaryPassword);
    user.token = null;

    dataService.persistUsers(users);
}

async function test(msg, commands, botMessage) {
    // botMessage.addText("test123");
    // let table = botMessage.addTable(["1", "2", "3"]);
    // table.addContentRow(["4", "5", "6"]);
    // let result = await botMessage.send();
    // console.log(result);
    let batchItems = [];
    batchItems.push(new BatchItem(731101, [19]));
    // batchItems.push(new BatchItem(731102, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19]));
    // batchItems.push(new BatchItem(731103, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19]));
    // let result = await dataServiceNew.getMarketItemsSubLists(batchItems);
    let result = await dataServiceNew.getMarketItemSubList(batchItems[0]);
    console.log(result);
}

client.on("messageCreate", async (msg) => {
    if (!msg.content.startsWith(PREFIX) || msg.author.bot) {
        return;
    }

    let commands = msg.content.substring(1).split(" ");

    let command = commandMap.get(commands[0]);
    if (command != null) {
        if (!command.dmOnly || !msg.guild) {
            if (command.commandLengthes && !command.commandLengthes.includes(commands.length)) {
                let replyText = "Invalid number of commands";
                if (command.helpText) {
                    replyText += `\n${command.helpText}`;
                }
                msg.react("❌");
                msg.reply(replyText);
            } else {
                let result;
                await msg.react("⏳");
                
                try {
                    let user = getOrCreateUser(msg.author.id, msg.author.username);
                    let botMessage = new PersonalMessage(client, user, msg);
                    if (command.function.constructor.name === "AsyncFunction") {
                        result = await command.function(msg, commands, botMessage);
                    } else {
                        result = command.function(msg, commands, botMessage);
                    }
                    discordUtils.changeReaction(msg, client.user, "👌");
                } catch (error) {
                    log("Exception when executing " + commands[0]);
                    console.error(error);
                    discordUtils.changeReaction(msg, client.user, "❌");
                }
            }
        } else {
            msg.reply("This specific command can only be utilized within direct messages")
        }
    } else {
        msg.reply("Command not found")
    }
});

client.login(discordToken);

// const checkInStockJob = schedule.scheduleJob('*/30 * * * * *', async function() {
//     let batchItems = inStockListGroups.reduce((accumulator, inStockListGroup) => accumulator.concat(inStockListGroup.batchItems), []);
//     console.log(batchItems);
//     dataServiceNew.getMarketItemsSubLists(batchItems, true)
//         .then(result => {
//             // console.log(result);

//             let validNotifyList = []

//             result.forEach(item => {
//                 if (!isNotified(item)) {
//                     validNotifyList.push(item);
//                 }
//             });

//             notifiedInStockList = notifiedInStockList.filter(element => {
//                 return result.some(item => item.id === element.id);
//             });

//             if (validNotifyList.length > 0) {
//                 webhooks.forEach(webhook => {
//                     let botMessage = new WebhookMessage(webhook);

//                     let validNotifyListForWebhook = validNotifyList.filter(item => {
//                         if (!webhook.ignoreItemList.some(ignoreItem => ignoreItem.id == item.id 
//                             && ignoreItem.sids.some(sid => sid == item.sid))) {
//                                 return true;
//                         }
//                     });

//                     if (validNotifyListForWebhook.length > 0) {
//                         botMessage.addText("物品上架");

//                         let table = botMessage.addTable(["道具", "強化等級", "數量"]);
//                         validNotifyListForWebhook.forEach(vaildItem => {
//                             table.addContentRow([vaildItem.name, dataService.displaySubId(vaildItem.id, vaildItem.sid), vaildItem.currentStock]);

//                             vaildItem.notifiedTime = Date.now();
//                             notifiedInStockList.push(vaildItem);
//                         });

//                         let subscribedUsers = getSubscibedUsers(validNotifyListForWebhook.map(validItem => validItem.id), webhook.channel);
//                         if (subscribedUsers.length > 0) {
//                             botMessage.addUserTags(subscribedUsers);
//                         }

//                         botMessage.send();
//                     }
//                 });
//             }
//         });
// });

// const checkWaitListJob = schedule.scheduleJob('*/30 * * * * *', async function() {
//     try {
//         const result = await dataService.checkWaitList(waitList);

//         let validNotifyList = [];

//         result.forEach(item => {
//             // TODO: refactor
//             if (!currentWaitList.some(notifiedWaitItem =>
//                     notifiedWaitItem.id == item.id 
//                     && notifiedWaitItem.subId == item.subId
//                     && notifiedWaitItem.price == item.price 
//                     && notifiedWaitItem.liveAt == item.liveAt)) {
//                 currentWaitList.push(item);
//                 validNotifyList.push(item);
//             }
//         });

//         webhooks.forEach(webhook => {
//             let botMessage = new WebhookMessage(webhook);
//             validNotifyList.forEach(item => {
//                 if (!webhook.ignoreItemList.some(ignoreItem => ignoreItem.id == item.id 
//                         && ignoreItem.sids.some(sid => sid == item.sid))) {
//                     let blockContent = botMessage.addBlock([`等待交易登記: 　　${item.name}`]);
//                     blockContent.addContent(`強化等級:　　　　 ${dataService.displaySubId(item.id, item.sid)}`);
//                     blockContent.addContent(`價錢:　　　　　　 ${item.price.toLocaleString()}`);
//                     blockContent.addContent(`上架時間:　　　　 ${moment(new Date(item.liveAt * 1000)).format('HH:mm:ss')}`);

//                     let subscribedUsers = getSubscibedUsers([item.id], webhook.channel);
//                     if (subscribedUsers.length > 0) {
//                         botMessage.addUserTags(subscribedUsers);
//                     }

//                     botMessage.send(); 
//                 }
//             })
//         })
        
//     } catch (error) {
//         console.error('Error checking wait list:', error);
//     }
// });

async function initWebhooks() {
    console.log(webhookUrls);

    webhookUrls.forEach(webhookData => {
        let ignoreItemList = [];
        if (webhookData.ignoreFiles) {
            webhookData.ignoreFiles.forEach(file => {
                ignoreItemList.push(...fileList[file]);
            });
        }

        webhooks.push({
            channel : webhookData.channel,
            webhook : new WebhookClient({ 
                url: webhookData.url,
                client: client
            }),
            ignoreItemList : ignoreItemList
        });
    });
}

function isNotified(item) {
    return notifiedInStockList.some(element => {
        if (element.id === item.id) {
            return element.currentStock === item.currentStock;
        }
        return false;
    });
}

function getSubscibedUsers(itemIds, channel) {
    let channelUsers = []; 

    users.forEach((user, userId) => {
        if (user.hasOwnProperty("channels") && user.channels.hasOwnProperty(channel)) {
            user.userId = userId;
            channelUsers.push(user);
        }
      });

    // = users.filter(
    //     user => !user.hasOwnProperty("channels") || !user.channels.hasOwnProperty(channel));

    let subscribedUserIdSet = new Set();

    for (let user of channelUsers) {
        if (user.channels[channel].hasOwnProperty("notifyItemIds")) {
            if (user.channels[channel].notifyItemIds.some(subscribedItemId => itemIds.some(itemId => subscribedItemId == itemId))) {
                subscribedUserIdSet.add(user.userId);
                continue;
            }
        }

        if (user.channels[channel].hasOwnProperty("notifyItemGroups")) {
            let itemGroupNotifyItemIds = [];
            for (let itemGroup of user.channels[channel].notifyItemGroups) {
                for (let fileName of registerItemGroupsMapping[itemGroup]?.fileNames) {
                    fileList[fileName].forEach(item => itemGroupNotifyItemIds.push(item.id));
                }
            }

            if (itemGroupNotifyItemIds.some(subscribedItemId => itemIds.some(itemId => subscribedItemId == itemId))) {
                subscribedUserIdSet.add(user.userId);
                continue;
            }
        }
    }

    return Array.from(subscribedUserIdSet);
}

function getOrCreateUser(id, username) {
    if (!users.has(id)) {
        users.set(id, username ? { name : msg.author.username } : {} );
        dataService.persistUsers(users);
    }

    return users.get(id);
}

async function refreshToken(user) {
    if (!user.encryptedEmail || !user.encryptedPassword || !user.encryptedSecondaryPassword) {
        return false;
    }
        
    let token = await tradeService.getToken(user.encryptedEmail, user.encryptedPassword, user.encryptedSecondaryPassword);
        
    if (!token) {
        return false;
    }

    log(`Refreshed token for ${discordUtils.getUserDisplayName(user)}`)
    
    user.token = token;
    dataService.persistUsers(users);

    return true;
}