import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuroraContextType {
    isCompletionPulse: boolean;
    setCompletionPulse: (value: boolean) => void;
}

const AuroraContext = createContext<AuroraContextType | undefined>(undefined);

export const AuroraProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isCompletionPulse, setCompletionPulse] = useState(false);

    return (
        <AuroraContext.Provider value={{ isCompletionPulse, setCompletionPulse }}>
            {children}
        </AuroraContext.Provider>
    );
};

export const useAuroraContext = () => {
    const context = useContext(AuroraContext);
    if (context === undefined) {
        throw new Error('useAuroraContext must be used within an AuroraProvider');
    }
    return context;
};
