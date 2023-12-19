const axios = require('axios').default;
const fs = require('fs');
const moment = require('moment');
const { log } = require('./src/utils/logUtils');
const parseUtils = require('./src/utils/parseUtils');

const url = "https://api.arsha.io"
const region = "tw";
const lang = "tw";

const subIdNNameMap = {
    16: "I",
    17: "II",
    18: "III",
    19: "IV",
    20: "V",
}

let itemList = [];

async function initDB() {
	let itemData;
    try {
        itemData = readDB('itemList.txt');
    } catch(ex) {
        log("No itemList.txt found, fetching online...");
        itemData = await updateDB();
    }

    log("Item list loaded, last update: " + (moment(itemData.updateTime).format('DD/MM HH:mm:ss')));

    itemList = itemData.itemList;
}

async function updateDB() {
    const dbDumpUrl = url + '/util/db/dump?lang=tw';

    try {
        let res = await axios.get(dbDumpUrl);
        let itemDb = { updateTime: Date.now(), itemList: res.data };

        writeDB("itemList.txt", itemDb);
        log("item database updated with " + itemDb.itemList.length + " items");
        return itemDb;
    } catch (ex) {
        console.log(ex);
    }
}

let searchItem = function searchItem(textArray) {
    let result = [];
    itemList.forEach(item => {
        let isInclude = true;

        for (let i in textArray) {
            if (!item.name.includes(textArray[i])) {
                isInclude = false;
                break;
            }
        }

        if (isInclude) {
            result.push(item);
        }
    });

    return result;
}

let searchItems = function searchItems(itemNameList) {
    let result = new Map();

    itemList.forEach(item => {
        for (itemName of itemNameList) {
            if (item.name === itemName) {
                console.log(item.name);
                result.set(item.name, item.id);
            }
        }
    });

    return result;
}

let getItem = function getItem(itemId) {
    for (let item of itemList) {
        if (item.id == Number(itemId)) {
            return item;
        }
    }

    return null;
}

function displaySubId(itemId, subId) {
    let subIdName = subIdNNameMap[subId];

    let result = `+${subId}`;

    if (subIdName) {
        result += ` (${subIdName})`;
    }

    return result;
}

async function getSubList(itemIdList) {
    let result = [];

    let splitedItemIdList = splitList(itemIdList, 1000);

    for (let i in splitedItemIdList) {
        let config = {
            headers: {
                'Content-Type': 'application/json'
            }
        }

        let data = splitedItemIdList[i].map(id => Number(id));
		
		try {
			let res = await axios.post(`${url}/v2/${region}/GetWorldMarketSubList?lang=${lang}`, data, config);
			result = result.concat(res.data);
		} catch (ex) {
			console.log(ex);
		}
    }

    if (!Array.isArray(result[0])) {
        result = [result];
    }

    return result;
}

// example item list: [{ id: 1, sids: [1 , 2, 3] }, ...]
async function checkStock(itemList) {
    const subList = await getSubList(itemList.map(notifyInStockItem => notifyInStockItem.id));
  
    const result = itemList.flatMap(notifyItem => {
      const matchingItems = subList
        .flatMap(sub => sub)
        .filter(item =>
          item.currentStock > 0 &&
          String(item.id) === notifyItem.id &&
          notifyItem.sids.includes(String(item.sid))
        );
  
      return matchingItems;
    });

    return result;
  }

// example item list: [{ id: 1, sids: [1, 2, 3] }, ...]
async function checkWaitList(itemList) {
    try {
        let waitList = (await axios.get(`${url}/v2/${region}/GetWorldMarketWaitList?lang=${lang}`)).data;
        if (!Array.isArray(waitList)) {
            waitList = [waitList];
        }
        const result = waitList.filter(waitItem => {
            return itemList.some(item => item.id == waitItem.id 
                && item.sids.includes(String(waitItem.sid)));
        });

        return result;
    } catch (ex) {
        // console.log(ex);
        return [];
    }
}

async function getPriceData(itemList, inStockOnly) {
    let data = await Promise.all(
        [
            getSubList(itemList.map(notifyInStockItem => notifyInStockItem.id)), 
            getBiddingInfoListData(itemList)
        ]);

    let result = new Map();

    for (subList of data[0]) {
        mapItem = [];
        if (!Array.isArray(subList)) {
            subList = [subList];
        }
        
        for (subListItem of subList) {
            mapItem[subListItem.sid] = { sid : subListItem.sid, lastSoldPrice : subListItem.lastSoldPrice };
        }

        result.set(subList[0].id, mapItem);
    }

    // Price logic:
    // sell price: max (min (last sold price, lowest in stock price), highest preorder price)
    // buy price: max (last sold price, highest preorder price), if lowest in stock price exist, replace with lowest in stock price
    for (biddingInfo of data[1]) {
        subList = result.get(biddingInfo.id)[biddingInfo.sid];

        let highestPreorder = null;
        let lowestInStock = null;
        for (order of biddingInfo.orders) {
            if (order.sellers > 0) {
                highestPreorder = highestPreorder == null ? order.price : Math.max(order.price, highestPreorder);
            }

            if (order.buyers > 0) {
                lowestInStock = lowestInStock == null ? order.price : Math.min(order.price, lowestInStock);
            }
        }

        let sellPrice = 0;
        let buyPrice = 0;
        if (subList.lastSoldPrice > 0) {
            sellPrice = subList.lastSoldPrice;
            buyPrice = subList.lastSoldPrice;
        }

        if (lowestInStock) {
            sellPrice = sellPrice == 0 ? lowestInStock : Math.min(sellPrice, lowestInStock);
        }
        if (highestPreorder) {
            sellPrice = sellPrice == 0 ? highestPreorder : Math.max(sellPrice, highestPreorder);
        }

        if (highestPreorder) {
            buyPrice = buyPrice == 0 ? highestPreorder : Math.max(buyPrice, highestPreorder);
        }
        if (lowestInStock) {
            buyPrice = lowestInStock;
        }

        subList.sellPrice = sellPrice;
        subList.buyPrice = buyPrice;
        subList.inStock = lowestInStock != null;

        if (inStockOnly && !subList.inStock) {
            result.get(biddingInfo.id).splice(biddingInfo.sid, 1);

            if (result.get(biddingInfo.id).length === 0) {
                result.delete(biddingInfo.id);
            }
        }
    }

    return result;
}

async function getBiddingInfoListData(itemList) {
    let idList = [];
    let sidList = [];
    
    for (item of itemList) {
        for (sid of item.sids) {
            idList.push(item.id);
            sidList.push(sid);
        }
    }


    let config = {
        headers: {
            id: idList.join(","),
            sid: sidList.join(",")
        }
    }
    
    try {
        let result = (await axios.post(`${url}/v2/${region}/GetBiddingInfoList`, null, config)).data;
        if (!Array.isArray(result)) {
            result = [result];
        }
        return result;
    } catch (ex) {
        console.log(ex);
    }
}

function splitList(list, splitSize) {
    let result = [];
    for (let i = 0; i < list.length; i += splitSize) {
        result.push(list.slice(i, i + splitSize));
    }

    return result;
}

function readDB(fileName) {
    let rawdata = fs.readFileSync(__dirname + '/'+ fileName);
    return JSON.parse(rawdata);
}

function writeDB(fileName, data) {
	fs.writeFileSync(__dirname + '/'+ fileName, JSON.stringify(data));
}

function persistUsers(users) {
    writeDB("users.json", Object.fromEntries(users))
}

exports.searchItem = searchItem;
exports.searchItems = searchItems;
exports.getItem = getItem;
exports.displaySubId = displaySubId;
exports.updateDB = updateDB;
exports.initDB = initDB;
exports.writeDB = writeDB;
exports.checkStock = checkStock;
exports.checkWaitList = checkWaitList;
exports.getBiddingInfoListData = getBiddingInfoListData;
exports.getPriceData = getPriceData;
exports.persistUsers = persistUsers;

// curl "https://trade.tw.playblackdesert.com/Trademarket/GetBiddingInfoList" -H 'Content-Type: application/json' -H 'User-Agent: BlackDesert' -X POST -d '{ "keyType": 0,"mainKey": 10210, "subKey": 0}' 
// curl "https://eu-trade.naeu.playblackdesert.com/Trademarket/GetWorldMarketHotList" -X POST 
// curl "https://eu-trade.naeu.playblackdesert.com/Trademarket/GetWorldMarketWaitList" -H 'Content-Type: application/json' -H 'User-Agent: BlackDesert' -X POST

// exports.updateCostumeDb = updateCostumeDb;

// function getCostumeList() {
//     let result = searchItem(['[', ']', '套裝']);

//     return result;
// }

// function searchItemInList(list, id) {
//     for (let i in list) {
//         if (list[i].id == id) {
//             return list[i];
//         }
//     }
// }

// async function updateCostumeDb() {
//     // console.log(readDB('costumeList.txt'));
//     let costumeList = readDB('costumeList.txt').costumeList;

//     // let costumeList = getCostumeList();

//     let costumeIdList = [];

//     for (let i in costumeList) {
//         costumeIdList.push(costumeList[i].id);
//     }

//     // console.log(costumeList);

//     let priceList = await getSubList(costumeIdList);

//     let costumeResultList = []
//     for (let i in priceList) {
//         let costumeData = priceList[i][0];
//         if (costumeData.name != null) {
//             let soldHistory = [];
//             let item = searchItemInList(costumeList, costumeData.id);
//             if (item != null) {
//                 if (item.soldHistory == null || item.soldHistory.length == 0) {
//                     soldHistory.push({
//                         totalTrades: costumeData.totalTrades,
//                         lastSoldTime: costumeData.lastSoldTime
//                     })
//                 } else {
//                     soldHistory = item.soldHistory;

//                     if (item.lastSoldTime != costumeData.lastSoldTime) {
//                         log("costume sold! " + item.name)

//                         soldHistory.push({
//                             totalTrades: costumeData.totalTrades,
//                             lastSoldTime: costumeData.lastSoldTime
//                         })
//                     }
//                 }
//             }

//             let costume = {
//                 id: costumeData.id,
//                 name: costumeData.name,
//                 totalTrades: costumeData.totalTrades,
//                 lastSoldTime: costumeData.lastSoldTime,
//                 soldHistory: soldHistory
//             }

//             costumeResultList.push(costume);
//         }
//     }

//     let costumeDb = { updateTime: Date.now(), costumeList: costumeResultList };

//     writeDB("costumeList.txt", costumeDb);

//     log("costumeList.txt updated");
// }