export type TierType = 'free' | 'pro' | 'enterprise';

export interface UsageStats {
    forms: number;
    responses: number;
}

export interface UsageLimits {
    forms: number;
    responses: number;
}

export interface UsageData {
    tier: TierType;
    stats: UsageStats;
    limits: UsageLimits;
}

export interface UsageContextType {
    usage: UsageData | null;
    loading: boolean;
    refreshUsage: () => Promise<void>;
    isWithinLimit: (resource: keyof UsageStats) => boolean;
}
