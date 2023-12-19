const fs = require('fs');
const convert = require('xml-js');
const path = require('path');
const { dataPath } = require('./dataConfig.json');

const fileName = "silverClothes.xml";

let list = [14029, 14028, 14026, 14025, 14024, 14023, 14022, 14021, 14020, 14019];
list = list.sort();

const enhanceLevelList = [2];

let xmlObject = {items : []};
list.forEach(item => {
    xmlObject.items.push({item: { id: item, sid: enhanceLevelList}});
});

fs.writeFileSync(path.join(__dirname, dataPath, fileName), convert.js2xml(xmlObject, { compact: true, spaces: 4 }));