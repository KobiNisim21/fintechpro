import api from './client';

export interface ApiKeyItem {
    _id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    expiresAt: string | null;
    lastUsedAt: string | null;
    revoked: boolean;
    createdAt: string;
}

export interface CreateKeyResponse {
    _id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    expiresAt: string | null;
    createdAt: string;
    rawKey: string;
    serverUrl: string;
    sseUrl: string;
}

export interface KeysResponse {
    keys: ApiKeyItem[];
    serverUrl: string;
    sseUrl: string;
}

export interface AuditLogItem {
    _id: string;
    apiKeyId?: string;
    keyName: string;
    action: string;
    symbol: string;
    details: string;
    beforeState: any;
    afterState: any;
    canUndo: boolean;
    undone: boolean;
    createdAt: string;
}

export interface McpTokenStatus {
    hasToken: boolean;
    token: string | null;
    createdAt: string | null;
    sseUrl: string | null;
    httpUrl: string | null;
}

export const mcpAPI = {
    // Get all user keys
    getKeys: async (): Promise<KeysResponse> => {
        const response = await api.get('/mcp/keys');
        return response.data;
    },

    // Create a new key
    createKey: async (data: { name: string; scopes: string[]; expiresInDays?: number | null }): Promise<CreateKeyResponse> => {
        const response = await api.post('/mcp/keys', data);
        return response.data;
    },

    // Revoke key
    revokeKey: async (id: string): Promise<{ message: string }> => {
        const response = await api.delete(`/mcp/keys/${id}`);
        return response.data;
    },

    // Get audit logs
    getAuditLogs: async (): Promise<AuditLogItem[]> => {
        const response = await api.get('/mcp/audit');
        return response.data;
    },

    // Undo action from audit log
    undoAudit: async (id: string): Promise<{ success: boolean; message: string }> => {
        const response = await api.post(`/mcp/audit/${id}/undo`);
        return response.data;
    },

    // Test connection with a token
    testConnection: async (token: string): Promise<{ success: boolean; toolsCount?: number; message?: string }> => {
        try {
            const response = await api.post('/mcp', {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list'
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data?.result?.tools) {
                return { success: true, toolsCount: response.data.result.tools.length };
            }
            return { success: false, message: response.data?.error?.message || 'Invalid response from server' };
        } catch (err: any) {
            return {
                success: false,
                message: err.response?.data?.error?.message || err.response?.data?.message || err.message
            };
        }
    },

    // Legacy status method
    getStatus: async (): Promise<McpTokenStatus> => {
        const response = await api.get('/mcp/token');
        return response.data;
    },

    // Legacy generate method
    generateToken: async (): Promise<McpTokenStatus> => {
        const response = await api.post('/mcp/token');
        return response.data;
    },

    // Legacy revoke method
    revokeToken: async (): Promise<{ message: string }> => {
        const response = await api.delete('/mcp/token');
        return response.data;
    }
};
