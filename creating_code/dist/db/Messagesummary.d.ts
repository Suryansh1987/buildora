import Anthropic from '@anthropic-ai/sdk';
import { type Message, type MessageSummary, type ConversationStats } from './schema';
import { IntelligentFileModifier, type ModificationResult } from '../services/filemodifier';
export declare class DrizzleMessageHistoryDB {
    private db;
    private anthropic;
    constructor(databaseUrl: string, anthropic: Anthropic);
    initializeStats(): Promise<void>;
    addMessage(content: string, messageType: 'user' | 'assistant', metadata?: {
        fileModifications?: string[];
        modificationApproach?: 'FULL_FILE' | 'TARGETED_NODES';
        modificationSuccess?: boolean;
    }): Promise<string>;
    private maintainRecentMessages;
    fixConversationStats(): Promise<void>;
    private updateGrowingSummary;
    private generateSummaryUpdate;
    getConversationContext(): Promise<string>;
    getRecentConversation(): Promise<{
        messages: Message[];
        summaryCount: number;
        totalMessages: number;
    }>;
    getCurrentSummary(): Promise<{
        summary: string;
        messageCount: number;
    } | null>;
    getConversationStats(): Promise<ConversationStats | null>;
    getAllSummaries(): Promise<MessageSummary[]>;
    clearAllData(): Promise<void>;
}
export declare class IntelligentFileModifierWithDrizzle extends IntelligentFileModifier {
    private messageDB;
    constructor(anthropic: Anthropic, reactBasePath: string, databaseUrl: string);
    initialize(): Promise<void>;
    processModificationWithHistory(prompt: string): Promise<ModificationResult>;
    getConversationForDisplay(): Promise<{
        messages: Message[];
        summaryCount: number;
        totalMessages: number;
    }>;
    getStats(): Promise<ConversationStats | null>;
}
