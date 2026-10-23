export interface ViewHistoryOptions {
    viewHistoryIdleSeconds: number;
    viewHistoryDistancePercent: number;
}

export function normalizeViewHistoryOptions(input?: Partial<ViewHistoryOptions>): ViewHistoryOptions {
    const valid = (value: unknown, min: number, max: number, fallback: number) =>
        typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
    return {
        viewHistoryIdleSeconds: valid(input?.viewHistoryIdleSeconds, 0.5, 60, 5),
        viewHistoryDistancePercent: valid(input?.viewHistoryDistancePercent, 1, 100, 25)
    };
}
