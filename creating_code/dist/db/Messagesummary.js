"use strict";
// Drizzle Database Client for Single User/Project Message History
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentFileModifierWithDrizzle = exports.DrizzleMessageHistoryDB = void 0;
const neon_http_1 = require("drizzle-orm/neon-http");
const serverless_1 = require("@neondatabase/serverless");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("./schema");
// Import the base class and types
const filemodifier_1 = require("../services/filemodifier");
class DrizzleMessageHistoryDB {
    constructor(databaseUrl, anthropic) {
        const sqlConnection = (0, serverless_1.neon)(databaseUrl);
        this.db = (0, neon_http_1.drizzle)(sqlConnection);
        this.anthropic = anthropic;
    }
    // Initialize conversation stats if not exists
    initializeStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield this.db.select().from(schema_1.conversationStats).where((0, drizzle_orm_1.eq)(schema_1.conversationStats.id, 1));
            if (existing.length === 0) {
                yield this.db.insert(schema_1.conversationStats).values({
                    id: 1,
                    totalMessageCount: 0,
                    summaryCount: 0,
                    lastMessageAt: null,
                    updatedAt: new Date()
                });
            }
        });
    }
    // Add a new message
    addMessage(content, messageType, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const newMessage = {
                content,
                messageType,
                fileModifications: (metadata === null || metadata === void 0 ? void 0 : metadata.fileModifications) || null,
                modificationApproach: (metadata === null || metadata === void 0 ? void 0 : metadata.modificationApproach) || null,
                modificationSuccess: (metadata === null || metadata === void 0 ? void 0 : metadata.modificationSuccess) || null,
                createdAt: new Date()
            };
            // Insert the message
            const result = yield this.db.insert(schema_1.messages).values(newMessage).returning({ id: schema_1.messages.id });
            const messageId = result[0].id;
            // Update conversation stats using SQL increment
            yield this.db.update(schema_1.conversationStats)
                .set({
                totalMessageCount: (0, drizzle_orm_1.sql) `${schema_1.conversationStats.totalMessageCount} + 1`,
                lastMessageAt: new Date(),
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_1.conversationStats.id, 1));
            // Check if we need to summarize (keep only 5 recent messages)
            yield this.maintainRecentMessages();
            return messageId;
        });
    }
    // Maintain only 5 recent messages, summarize older ones
    maintainRecentMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            // Get all messages ordered by creation time
            const allMessages = yield this.db.select().from(schema_1.messages).orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt));
            // If we have more than 5 messages, summarize the older ones
            if (allMessages.length > 5) {
                const recentMessages = allMessages.slice(0, 5);
                const oldMessages = allMessages.slice(5);
                // Create summary from old messages
                if (oldMessages.length > 0) {
                    yield this.createSummary(oldMessages);
                }
                // Delete old messages (keep only recent 5)
                const oldMessageIds = oldMessages.map(m => m.id);
                for (const id of oldMessageIds) {
                    yield this.db.delete(schema_1.messages).where((0, drizzle_orm_1.eq)(schema_1.messages.id, id));
                }
            }
        });
    }
    // Create a summary from old messages using Claude
    createSummary(oldMessages) {
        return __awaiter(this, void 0, void 0, function* () {
            const { summary, keyTopics } = yield this.generateSummary(oldMessages);
            const newSummary = {
                summary,
                messageCount: oldMessages.length,
                startTime: oldMessages[oldMessages.length - 1].createdAt, // Oldest first
                endTime: oldMessages[0].createdAt, // Newest first
                keyTopics,
                createdAt: new Date()
            };
            yield this.db.insert(schema_1.messageSummaries).values(newSummary);
            // Update summary count in stats using SQL increment
            yield this.db.update(schema_1.conversationStats)
                .set({
                summaryCount: (0, drizzle_orm_1.sql) `${schema_1.conversationStats.summaryCount} + 1`,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_1.conversationStats.id, 1));
        });
    }
    // Generate summary using Claude
    generateSummary(oldMessages) {
        return __awaiter(this, void 0, void 0, function* () {
            const messagesText = oldMessages.reverse().map(msg => {
                let text = `[${msg.messageType.toUpperCase()}]: ${msg.content}`;
                if (msg.fileModifications && msg.fileModifications.length > 0) {
                    text += ` (Modified: ${msg.fileModifications.join(', ')})`;
                }
                return text;
            }).join('\n\n');
            const claudePrompt = `
Summarize this conversation about React file modifications. Focus on:
1. What changes were requested
2. Which files were modified  
3. What approaches were used
4. Any issues or successes

**Messages:**
${messagesText}

**Response Format:**
{
  "summary": "Brief summary of the conversation",
  "keyTopics": ["topic1", "topic2", "topic3"]
}

Return only the JSON.
    `.trim();
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 500,
                    temperature: 0,
                    messages: [{ role: 'user', content: claudePrompt }],
                });
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[0]);
                        return {
                            summary: result.summary,
                            keyTopics: result.keyTopics || []
                        };
                    }
                }
            }
            catch (error) {
                console.error('Error generating summary:', error);
            }
            // Fallback summary
            return {
                summary: `React modification conversation (${oldMessages.length} messages)`,
                keyTopics: ['react', 'file-modification']
            };
        });
    }
    // Get conversation context for file modification prompts
    getConversationContext() {
        return __awaiter(this, void 0, void 0, function* () {
            // Get summaries
            const summaries = yield this.db.select().from(schema_1.messageSummaries).orderBy((0, drizzle_orm_1.desc)(schema_1.messageSummaries.createdAt));
            // Get recent messages
            const recentMessages = yield this.db.select().from(schema_1.messages).orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt));
            let context = '';
            // Add summaries
            if (summaries.length > 0) {
                context += '**Previous Conversation Summary:**\n';
                summaries.forEach((summary, index) => {
                    context += `${index + 1}. ${summary.summary} (${summary.messageCount} messages)\n`;
                    if (summary.keyTopics && summary.keyTopics.length > 0) {
                        context += `   Topics: ${summary.keyTopics.join(', ')}\n`;
                    }
                });
                context += '\n';
            }
            // Add recent messages
            if (recentMessages.length > 0) {
                context += '**Recent Messages:**\n';
                recentMessages.reverse().forEach((msg, index) => {
                    context += `${index + 1}. [${msg.messageType.toUpperCase()}]: ${msg.content}\n`;
                    if (msg.fileModifications && msg.fileModifications.length > 0) {
                        context += `   Modified: ${msg.fileModifications.join(', ')}\n`;
                    }
                });
            }
            return context;
        });
    }
    // Get recent conversation for display
    getRecentConversation() {
        return __awaiter(this, void 0, void 0, function* () {
            // Get recent messages
            const recentMessages = yield this.db.select().from(schema_1.messages).orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt));
            // Get stats
            const stats = yield this.db.select().from(schema_1.conversationStats).where((0, drizzle_orm_1.eq)(schema_1.conversationStats.id, 1));
            const currentStats = stats[0] || { totalMessageCount: 0, summaryCount: 0 };
            return {
                messages: recentMessages,
                summaryCount: currentStats.summaryCount || 0,
                totalMessages: currentStats.totalMessageCount || 0
            };
        });
    }
    // Get conversation stats
    getConversationStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.db.select().from(schema_1.conversationStats).where((0, drizzle_orm_1.eq)(schema_1.conversationStats.id, 1));
            return stats[0] || null;
        });
    }
    // Get all summaries
    getAllSummaries() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.db.select().from(schema_1.messageSummaries).orderBy((0, drizzle_orm_1.desc)(schema_1.messageSummaries.createdAt));
        });
    }
    // Clear all conversation data (for testing/reset)
    clearAllData() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.delete(schema_1.messages);
            yield this.db.delete(schema_1.messageSummaries);
            yield this.db.update(schema_1.conversationStats)
                .set({
                totalMessageCount: 0,
                summaryCount: 0,
                lastMessageAt: null,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_1.conversationStats.id, 1));
        });
    }
}
exports.DrizzleMessageHistoryDB = DrizzleMessageHistoryDB;
// Usage with IntelligentFileModifier
class IntelligentFileModifierWithDrizzle extends filemodifier_1.IntelligentFileModifier {
    constructor(anthropic, reactBasePath, databaseUrl) {
        super(anthropic, reactBasePath);
        this.messageDB = new DrizzleMessageHistoryDB(databaseUrl, anthropic);
    }
    // Initialize the database
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.messageDB.initializeStats();
        });
    }
    // Process modification with message history
    processModificationWithHistory(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Add user message
            yield this.messageDB.addMessage(prompt, 'user');
            // Get conversation context
            const context = yield this.messageDB.getConversationContext();
            // Modify the prompt to include context
            const enhancedPrompt = context ? `${context}\n\n**Current Request:** ${prompt}` : prompt;
            // Process the modification with enhanced context
            const result = yield this.processModification(enhancedPrompt);
            // Add assistant response
            const assistantResponse = result.success
                ? `Successfully modified ${((_a = result.selectedFiles) === null || _a === void 0 ? void 0 : _a.length) || 0} files using ${result.approach} approach.`
                : `Failed to modify files: ${result.error}`;
            yield this.messageDB.addMessage(assistantResponse, 'assistant', {
                fileModifications: result.selectedFiles,
                modificationApproach: result.approach,
                modificationSuccess: result.success
            });
            return result;
        });
    }
    // Get conversation for display
    getConversationForDisplay() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.messageDB.getRecentConversation();
        });
    }
    // Get conversation stats
    getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.messageDB.getConversationStats();
        });
    }
}
exports.IntelligentFileModifierWithDrizzle = IntelligentFileModifierWithDrizzle;
//# sourceMappingURL=Messagesummary.js.map