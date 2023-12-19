import moment from 'moment';
import clc from 'cli-color';

export function log(message: string) {
    let now = new Date().getTime();
    console.log(clc.green(moment(now).format('DD/MM HH:mm:ss')) + " " + message);
}