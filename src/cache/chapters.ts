import axios from "axios";

import CacheManager from "../classes/cache";

const chaptersCache = new CacheManager("chapters");

export function getChapter(key: string, number: string): Promise<Array<string>> {
    return new Promise<Array<string>>(resolve => {
        chaptersCache.has(`${key}_${number}`).then(() => {
            chaptersCache.get<Array<string>>(`${key}_${number}`).then(value => resolve(value));
        }).catch(() => {
            axios.get(`https://guya.moe/api/series/${key}`).then(r => r.data.chapters).then(chapters => {
                const chapter = chapters[number];

                const groupId = Object.keys(chapter.groups)[0];
                const group: Array<any> = chapter.groups[groupId];

                const pages = group.map(e => `${chapter.folder}/${groupId}/${e}`);
                chaptersCache.set(`${key}_${number}`, pages).then(() => resolve(pages));
            });
        });
    })
}
