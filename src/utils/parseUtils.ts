const recordSeparator = '|';
const valueSeparator = '-';

export function parseApiResponse(responseData: string, keys: string[], toMerge?: {}): {}[] {
    let result = [];
    let records = responseData.split(recordSeparator).slice(0, -1);
    for (let record of records) {
        let values = record.split(valueSeparator);

        let recordObject: { [key: string]: any } = {};
        let index = 0;
        while (index < values.length && index < keys.length) {
            recordObject[keys[index]] = values[index];
            index ++;
        }

        if (toMerge) {
            for (let [key, value] of Object.entries(toMerge)) {
                recordObject[key] = value;
            }
        }

        result.push(recordObject);
    }

    return result;
}