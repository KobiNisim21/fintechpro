export function deduplicateLiveAlerts<T extends {
    ticker: string;
    type: string;
    message: string;
    timestamp: string | Date;
}>(alerts: readonly T[]): T[];
