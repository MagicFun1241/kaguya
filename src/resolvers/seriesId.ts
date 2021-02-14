const seriesIdResolver = new Map<string, string>();

export function resolveSeriesId(seriesName: string) {
    return seriesIdResolver.get(seriesName);
}

export function resolveSeriesName(seriesId: string): string {
    const r = Array.from(seriesIdResolver.entries()).filter(([ value, key ]) => key === seriesId).map(e => e[0]);
    return r[0];
}

export function putSeriesId(seriesName: string, id: string) {
    seriesIdResolver.set(seriesName, id)
}
