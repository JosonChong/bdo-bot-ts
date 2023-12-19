import { Message, User } from "discord.js";

function formatBlock(text: string): string {
    return "```" + text + "```";
}

function formatUserTag(userId: string|number): string {
    return `<@${userId}>`;
}

function formatUserTags(userIds: string[]|number[]): string[] {
    return userIds.map(userId => formatUserTag(userId));
}

function strLen(str: any): number {
    str = String(str);
    let l = str.length;
    let length = 0;
    for (let i = 0; i < l; i++) {
        let c = str.charCodeAt(i);
        if (0x0000 <= c && c <= 0x0019) {
            length += 0;
        } else if (0x0020 <= c && c <= 0x1FFF) {
            length += 1;
        } else if (0x2000 <= c && c <= 0xFF60) {
            length += 2;
        } else if (0xFF61 <= c && c <= 0xFF9F) {
            length += 1;
        } else if (0xFFA0 <= c) {
            length += 2;
        }
    }

    return length;
}

function formatTable(rows: any[][]): string {
    let result = "";

    let maxColumn = 0;
    let rowStrings: string[] = [];
    for (let i in rows) {
        rowStrings[i] = "";
        if (rows[i].length > maxColumn) {
            maxColumn = rows[i].length;
        }
    }

    for (let i = 0; i < maxColumn; i++) {
        let maxLength = 0;
        for (let row of rows) {
            let length = strLen(row[i]);
            if (length > maxLength) {
                maxLength = length;
            }
        }

        for (let j in rows) {
            let text = String(rows[j][i]);
            let halfSpaceCount = maxLength - strLen(text);
            let spaces = "";
            for (let k = 0; k < halfSpaceCount / 2; k++) {
                spaces += "　";
            }

            if (halfSpaceCount % 2 === 0) {
                spaces += " ";
            }

            rowStrings[j] += text + spaces;
            rowStrings[j] += "　";
        }
    }

    for (let rowString of rowStrings) {
        result += rowString;
        result += "\n";
    }

    return formatBlock(result);
}

function getUserDisplayName(user: any) {
    let displayName = "User ";
    if (user.username) {
        displayName += user.username;
    } else {
        displayName += `ID: ${user.userId}` 
    }

    return displayName;
}

async function changeReaction(msg: Message, bot: User, newReaction: string) {
    const userReactions = msg.reactions.cache.filter(reaction => reaction.users.cache.has(bot.id));
    try {
        for (const reaction of userReactions.values()) {
            await reaction.users.remove(bot.id);
        }
    } catch (ignored) {}
    
    await msg.react(newReaction);
}

export { formatBlock, formatUserTags, formatTable, getUserDisplayName, changeReaction };