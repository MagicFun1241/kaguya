import * as level from 'level';

export default class CacheManager {
    private db;

    constructor(name: string) {
        this.db = level(`storage/${name}`);
    }

    has(id: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.db.get(id, err => {
                if (err) reject();
                else resolve();
            });
        });
    }

    set<T>(id, value): Promise<void> {
        return new Promise<void>(resolve => {
            this.db.put(id, JSON.stringify(value));

            resolve();
        });
    }

    get<T>(id: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.db.get(id, (err, value) => {
                if (err) reject();
                else resolve(JSON.parse(value));
            });
        });
    }
}
