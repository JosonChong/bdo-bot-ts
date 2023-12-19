const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const puppeteer = require('puppeteer');

const { chromiumPath, hashSecret } = require('./config.json');
const algorithm = 'aes-256-cbc';
const iv = Buffer.from("9dd9229cb8ebd8e0");

const resultMsgMap = {
    '30': { msg : "alreadyReserved", displayMsg : "物品已預購"},
    '-121': { msg : "marketMaxWeight", displayMsg : "交易所超過負重"},
    '-9999': { msg : "invalidToken", displayMsg : "trade token is invalid or expiried"},
    '2000': { msg : "invalidToken", displayMsg : "trade token is invalid or expiried"},
    '-16': { msg : "notEnoughMoney", displayMsg : "Not enough money" }
}


// itemid-?-amount-buyingPrice-fulfilledAmount-totalTradePrice-?-newRetryBiddingNo-oldRetryBiddingNo-?
// '9601-0-10-30600-10-304900-0-0-0-False'
// 41909032
async function buyItem(token, id, sid, price, count, buyChooseKey, retryBiddingNo) {
    const myHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
        'Cookie': `TradeAuth_session=${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const data = new URLSearchParams();
    data.append('buyMainKey', id);
    data.append('buySubKey', sid);
    data.append('buyPrice', price);
    data.append('buyCount', count);
    if (buyChooseKey) {
        data.append('buyChooseKey', buyChooseKey);
    }
    if (retryBiddingNo) {
        data.append('retryBiddingNo', retryBiddingNo);
    }

    const requestOptions = {
        httpsAgent: new https.Agent({
            secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        }),
        headers: myHeaders,
        data: data,
        method: 'post',
        url: 'https://game-trade.tw.playblackdesert.com/GameTradeMarket/BuyItem',
        redirect: 'follow'
    };

    try {
        let response = await axios(requestOptions);
        if (response.data.resultCode != 0) {
            console.log(response.data);
            return getFailedDetails(response.data.resultCode);
        }

        console.log(response.data.resultMsg);

        let resultMsgSplits = response.data.resultMsg.split('-');

        return { success : true, fulfilledAmount : Number(resultMsgSplits[4]), reservedAmount : Number(resultMsgSplits[2]) - Number(resultMsgSplits[4]) };
    } catch (err) {
        console.log('error', err);
        return false;
    }
}

async function getBiddingList(token) {
    const myHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
        'Cookie': `TradeAuth_session=${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const requestOptions = {
        httpsAgent: new https.Agent({
            secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        }),
        headers: myHeaders,
        method: 'post',
        url: 'https://trade.tw.playblackdesert.com/Home/GetMyBiddingList',
        redirect: 'follow'
    };

    try {
        let response = await axios(requestOptions);
        if (response.data.resultCode != 0) {
            return getFailedDetails(response.data.resultCode);
        }

        return { success : true, buyList : response.data.buyList };
    } catch (err) {
        console.log('error', err);
        return false;
    }
}

async function getToken(encryptedEmail, encryptedPassword, encryptedSecondaryPassword) {
    let email = decrypt(encryptedEmail);
    let password = decrypt(encryptedPassword);
    let secondaryPassword = decrypt(encryptedSecondaryPassword);
    
    let puppeteerSettings = {
        headless: "new",
        args: ["--no-sandbox"],
    }

    if (chromiumPath) {
        puppeteerSettings.executablePath = chromiumPath;
    }

    const browser = await puppeteer.launch(puppeteerSettings);
    const page = await browser.newPage();
    await page.goto('https://account.tw.playblackdesert.com/Member/Login?_returnUrl=https%3A%2F%2Ftrade.tw.playblackdesert.com%2FauthCallback');
    await page.type('#_email', email);
    await page.type('#_password', password);

    page.on('dialog', async dialog => {
        await dialog.accept();
        
        throw new Error('Dialog shown when logging in, message: ' + dialog.message());
    });

    await page.click('#doLogin');
    await page.waitForNavigation();
    await page.waitForResponse("https://trade.tw.playblackdesert.com/Home/GetMyBiddingList");
    await page.waitForTimeout(5000);
    await page.type('#inputSecondPwd', secondaryPassword);

    await page.click('#confirmSecondPwd');
    await page.waitForTimeout(5000);

    let cookies = await page.cookies();
    return cookies.filter(cookie => cookie.name == "TradeAuth_Session")[0].value;
};

function encrypt(text) {
    const key = crypto.createHash('sha256').update(hashSecret).digest('base64').substr(0, 32);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(encrypted) {
    const key = crypto.createHash('sha256').update(hashSecret).digest('base64').substr(0, 32);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function getFailedDetails(resultCode) {
    let reason = {};

    if (resultMsgMap[resultCode]) {
        reason = resultMsgMap[resultCode];
        reason[reason.msg] = true;
    }

    reason.resultCode = resultCode;
    
    return { success : false, reason : reason };
}

exports.buyItem = buyItem;
exports.getBiddingList = getBiddingList;
exports.getToken = getToken;
exports.encrypt = encrypt;
exports.decrypt = decrypt;