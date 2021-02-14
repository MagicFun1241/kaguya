import * as download from "download";
import {
    createHash
} from "crypto";

import CacheManager from "../classes/cache";

const imagesCache = new CacheManager("images");

interface Resolvable {
    id: string;
    method: "fileId" | "buffer";
    data: any;

    put: (value: string) => Promise<void>;
}

export function resolveImage(url: string): Promise<Resolvable> {
    return new Promise<Resolvable>(resolve => {
        const id = createHash("sha1").update(url).digest("base64");

        imagesCache.has(id).then(async () => resolve({
            id,
            method: "fileId",
            data: await imagesCache.get(id),

            put: (value) => imagesCache.set(id, value)
        })).catch(async () => resolve({
            id,
            method: "buffer",
            data: await download(url),

            put: (value) => imagesCache.set(id, value)
        }));
    });
}

export async function replyPhoto(ctx, url: string, params: any = {}) {
    resolveImage(url).then(r => {
        if (r.method === "buffer") {
            ctx.replyWithPhoto({ source: r.data }, params).then(m => {
                imagesCache.set(r.id, m.photo[0].file_id);
            });
        } else ctx.replyWithPhoto(r.data, params);
    })
}
