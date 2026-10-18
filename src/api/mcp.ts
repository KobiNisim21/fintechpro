import api from './client';

export interface McpTokenStatus {
    hasToken: boolean;
    token: string | null;
    createdAt: string | null;
    sseUrl: string | null;
    httpUrl: string | null;
}

export const mcpAPI = {
    // Get current user's MCP token status
    getStatus: async (): Promise<McpTokenStatus> => {
        const response = await api.get('/mcp/token');
        return response.data;
    },

    // Generate or regenerate personal MCP token
    generateToken: async (): Promise<McpTokenStatus> => {
        const response = await api.post('/mcp/token');
        return response.data;
    },

    // Revoke personal MCP token
    revokeToken: async (): Promise<{ message: string }> => {
        const response = await api.delete('/mcp/token');
        return response.data;
    }
};
