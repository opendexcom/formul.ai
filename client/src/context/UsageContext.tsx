import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth} from './AuthContext';
import { UsageData, UsageContextType, UsageStats } from '../types/usage';

const UsageContext = createContext<UsageContextType | undefined>(undefined);

export const useUsage = (): UsageContextType => {
    const context = useContext(UsageContext);
    if (!context) {
        throw new Error('useUsage must be used within an UsageProvider');
    }
    return context;
};

interface UsageProviderProps {
    children: React.ReactNode;
}

const MOCK_USAGE: UsageData = {
    tier: 'free',
    usage: { forms: 5, responses: 120 },
    limits: { forms: 10, responses: 500 }
}

export const UsageProvider: React.FC<UsageProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    // TODO: Fetch usage from API

    useEffect(() => {
        const fetchUsage = async () => {
            if (!user) {
                setUsage(null);
                setLoading(false);
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            setUsage(MOCK_USAGE);
            setLoading(false);
        };

        fetchUsage();

    }, [user]);
    // TODO: Refresh usage from API 
    const refreshUsage = async () => {
        if (!user) return;
        await new Promise(resolve => setTimeout(resolve,500));
        setUsage(MOCK_USAGE);
    };

    const isWithinLimit = (resource: keyof UsageStats): boolean => {
        if (!usage) return false;
        
        const limit = usage.limits[resource];
        if (limit === -1) return true;
        return usage.usage[resource] < limit;
    };

    const value: UsageContextType = {
        usage,
        loading,
        refreshUsage,
        isWithinLimit,
    };

    return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>;

}