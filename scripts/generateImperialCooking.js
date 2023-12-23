const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const convert = require('xml-js');
const { dataPath } = require('./dataConfig.json');
const dataService = require('./dataService');

// HTML block to scan
const htmlBlock = fs.readFileSync(path.join(__dirname, dataPath, 'garmothImperialCooking.html'), 'utf8')

// Load the HTML block into Cheerio
const $ = cheerio.load(htmlBlock);

// Extract data from the table rows
const tableRows = $('table tr');

let packageMap = new Map();

tableRows.each((index, element) => {
  // Ignore the first row (header row)
  if (index !== 0) {
    const row = $(element);

    const splittedText = row.find('td:nth-child(3)').text().trim().split(' x');
    const package = splittedText[0];
    const quantity = parseInt(splittedText[1]);

    packageMap.set(package, quantity);
  }
});

xmlObject = { items : [] };
dataService.initDB().then(() => {
    let result = dataService.searchItems(Array.from(packageMap.keys()));

    result.forEach((value, key) => {
        let data = {item : { id : value, sid : [0], name : key, quantity : packageMap.get(key) }};
        xmlObject.items.push(data);
    });

    fs.writeFileSync(path.join(__dirname, dataPath, "imperialCooking.xml"), convert.js2xml(xmlObject, { compact: true, spaces: 4 }));
})
