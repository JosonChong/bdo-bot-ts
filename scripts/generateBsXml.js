const fs = require('fs');
const convert = require('xml-js');
const commonUtil = require('../src/utils/commonUtils');

const homePath = "/../../";
const mainHandBSList = [690563, 692045, 715001, 715003, 715005, 715007, 715009, 715011, 715013, 715016, 715017, 715019, 715021, 718616, 730564, 732313, 733063, 735463, 739463, 740763];
const awakBSList = [731101, 731102, 731103, 731104, 731105, 731106, 731107, 731108, 731109, 731110, 731111, 731112, 731113, 731114, 731115, 731116, 731117, 731118, 731119, 731120, 731121, 731122, 731123];
const offHandBSList = [735001, 735002, 735003, 735004, 735005, 735006, 735007, 735008, 735009, 735010, 735011, 735012, 735013, 735014, 735015, 735016, 735017, 735018];

const bsEnhanceLevelList = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
// const bsEnhanceLevelList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];

let xmlObject = {items : []};
mainHandBSList.forEach(item => {
    xmlObject.items.push({item: { id: item, sid: bsEnhanceLevelList}});
});

fs.writeFileSync(commonUtil.getXmlPath(homePath, "mainHandBlackstar.xml"), convert.js2xml(xmlObject, { compact: true, spaces: 4 }));

xmlObject = {items : []};
awakBSList.forEach(item => {
    xmlObject.items.push({item: { id: item, sid: bsEnhanceLevelList}});
});

fs.writeFileSync(commonUtil.getXmlPath(homePath, "awakBlackstar.xml"), convert.js2xml(xmlObject, { compact: true, spaces: 4 }));

xmlObject = {items : []};
offHandBSList.forEach(item => {
    xmlObject.items.push({item: { id: item, sid: bsEnhanceLevelList}});
});

fs.writeFileSync(commonUtil.getXmlPath(homePath, "offHandBlackstar.xml"), convert.js2xml(xmlObject, { compact: true, spaces: 4 }));