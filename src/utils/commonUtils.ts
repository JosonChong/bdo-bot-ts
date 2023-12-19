import path from 'path';
import { hashSecret } from '../../configs/config.json';
import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
const iv = Buffer.from("9dd9229cb8ebd8e0");

export function getHomeFilePath(homePath: string, fileName: string) {
    return path.join(__dirname, homePath, fileName);
}

export function getConfigPath(homePath: string, fileName: string): string {
    return path.join(__dirname, homePath, "configs/", fileName);
}

export function getXmlPath(homePath: string, fileName: string): string {
    return path.join(__dirname, homePath, "data/", fileName);
}

export function encrypt(text: string) {
    const key = crypto.createHash('sha256').update(hashSecret).digest('base64').substr(0, 32);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

export function decrypt(encryptedText: string) {
    const key = crypto.createHash('sha256').update(hashSecret).digest('base64').substr(0, 32);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}