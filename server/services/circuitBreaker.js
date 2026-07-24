export const createCircuitBreaker = (serviceName, options = {}) => {
    const maxFailures = options.maxFailures || 3;
    const openStateDuration = options.openStateDuration || 60000;
    
    let state = 'CLOSED'; // CLOSED, OPEN, HALF-OPEN
    let failures = 0;
    let nextAttempt = 0;

    const logTransition = (newState) => {
        console.log(`[Circuit Breaker] ${serviceName} transitioned to ${newState}`);
        state = newState;
    };

    return async (fn) => {
        const now = Date.now();

        if (state === 'OPEN') {
            if (now >= nextAttempt) {
                logTransition('HALF-OPEN');
            } else {
                throw new Error(`Circuit breaker is OPEN for ${serviceName}`);
            }
        }

        try {
            const result = await fn();
            
            if (state === 'HALF-OPEN') {
                logTransition('CLOSED');
                failures = 0;
            } else if (state === 'CLOSED' && failures > 0) {
                failures = 0; // Reset failures on successful call
            }
            
            return result;
        } catch (error) {
            if (state === 'HALF-OPEN') {
                logTransition('OPEN');
                nextAttempt = Date.now() + openStateDuration;
            } else if (state === 'CLOSED') {
                failures++;
                if (failures >= maxFailures) {
                    logTransition('OPEN');
                    nextAttempt = Date.now() + openStateDuration;
                }
            }
            throw error;
        }
    };
};
