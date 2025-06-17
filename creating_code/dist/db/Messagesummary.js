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
            const allMessages = yield this.db.select().from(schema_1.messages).orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt));
            if (allMessages.length > 5) {
                const recentMessages = allMessages.slice(0, 5);
                const oldMessages = allMessages.slice(5);
                if (oldMessages.length > 0) {
                    // Update the single growing summary instead of creating new ones
                    yield this.updateGrowingSummary(oldMessages);
                }
                // Delete old messages (keep only recent 5)
                const oldMessageIds = oldMessages.map(m => m.id);
                for (const id of oldMessageIds) {
                    yield this.db.delete(schema_1.messages).where((0, drizzle_orm_1.eq)(schema_1.messages.id, id));
                }
            }
        });
    }
    fixConversationStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Count actual messages
                const allMessages = yield this.db.select().from(schema_1.messages);
                const messageCount = allMessages.length;
                // Count summaries
                const summaries = yield this.db.select().from(schema_1.messageSummaries);
                const summaryCount = summaries.length;
                // Get summary message count
                const latestSummary = summaries[0];
                const summarizedMessageCount = (latestSummary === null || latestSummary === void 0 ? void 0 : latestSummary.messageCount) || 0;
                // Calculate total messages
                const totalMessages = messageCount + summarizedMessageCount;
                // Update stats
                yield this.db.update(schema_1.conversationStats)
                    .set({
                    totalMessageCount: totalMessages,
                    summaryCount: summaryCount > 0 ? 1 : 0, // Since we only keep one summary
                    lastMessageAt: allMessages.length > 0 ? allMessages[allMessages.length - 1].createdAt : null,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.conversationStats.id, 1));
                console.log(`✅ Fixed stats: ${totalMessages} total messages, ${summaryCount} summaries`);
            }
            catch (error) {
                console.error('Error fixing conversation stats:', error);
            }
        });
    }
    updateGrowingSummary(newMessages) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the existing summary
            const existingSummaries = yield this.db.select().from(schema_1.messageSummaries).orderBy((0, drizzle_orm_1.desc)(schema_1.messageSummaries.createdAt)).limit(1);
            const existingSummary = existingSummaries[0];
            // Generate new content to add to summary
            const { summary: newContent } = yield this.generateSummaryUpdate(newMessages, existingSummary === null || existingSummary === void 0 ? void 0 : existingSummary.summary);
            if (existingSummary) {
                // Update existing summary by appending new content
                yield this.db.update(schema_1.messageSummaries)
                    .set({
                    summary: newContent,
                    messageCount: existingSummary.messageCount + newMessages.length,
                    endTime: newMessages[0].createdAt, // Most recent time
                    //@ts-ignore
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.messageSummaries.id, existingSummary.id));
            }
            else {
                // Create first summary
                const newSummary = {
                    summary: newContent,
                    messageCount: newMessages.length,
                    startTime: newMessages[newMessages.length - 1].createdAt, // Oldest
                    endTime: newMessages[0].createdAt, // Newest
                    keyTopics: ['react', 'file-modification'],
                    createdAt: new Date()
                };
                yield this.db.insert(schema_1.messageSummaries).values(newSummary);
            }
            // Update summary count in stats
            if (!existingSummary) {
                yield this.db.update(schema_1.conversationStats)
                    .set({
                    summaryCount: 1,
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(schema_1.conversationStats.id, 1));
            }
        });
    }
    // Generate updated summary using Claude
    generateSummaryUpdate(newMessages, existingSummary) {
        return __awaiter(this, void 0, void 0, function* () {
            const newMessagesText = newMessages.reverse().map(msg => {
                let text = `[${msg.messageType.toUpperCase()}]: ${msg.content}`;
                if (msg.fileModifications && msg.fileModifications.length > 0) {
                    text += ` (Modified: ${msg.fileModifications.join(', ')})`;
                }
                return text;
            }).join('\n\n');
            const claudePrompt = existingSummary
                ? `Update this existing conversation summary by incorporating the new messages:

**EXISTING SUMMARY:**
${existingSummary}

**NEW MESSAGES TO ADD:**
${newMessagesText}

**Instructions:**
- Merge the new information into the existing summary
- Keep the summary concise but comprehensive
- Focus on: what was built/modified, key changes made, approaches used, files affected
- Return only the updated summary text, no JSON`
                : `Create a concise summary of this React development conversation:

**MESSAGES:**
${newMessagesText}

**Instructions:**
- Focus on: what was built/modified, key changes made, approaches used, files affected
- Keep it concise but informative
- Return only the summary text, no JSON`;
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 800,
                    temperature: 0,
                    messages: [{ role: 'user', content: claudePrompt }],
                });
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    return { summary: firstBlock.text.trim() };
                }
            }
            catch (error) {
                console.error('Error generating summary update:', error);
            }
            // Fallback
            const fallbackSummary = existingSummary
                ? `${existingSummary}\n\nAdditional changes: React modifications (${newMessages.length} more messages)`
                : `React development conversation (${newMessages.length} messages)`;
            return { summary: fallbackSummary };
        });
    }
    // Get conversation context for file modification prompts
    getConversationContext() {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the single summary
            const summaries = yield this.db.select().from(schema_1.messageSummaries).orderBy((0, drizzle_orm_1.desc)(schema_1.messageSummaries.createdAt)).limit(1);
            // Get recent messages
            const recentMessages = yield this.db.select().from(schema_1.messages).orderBy((0, drizzle_orm_1.desc)(schema_1.messages.createdAt));
            let context = '';
            // Add the single growing summary
            if (summaries.length > 0) {
                const summary = summaries[0];
                context += `**CONVERSATION SUMMARY (${summary.messageCount} previous messages):**\n`;
                context += `${summary.summary}\n\n`;
            }
            // Add recent messages
            if (recentMessages.length > 0) {
                context += '**RECENT MESSAGES:**\n';
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
    // Get current summary for display - MOVED TO CORRECT CLASS
    getCurrentSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const summaries = yield this.db.select().from(schema_1.messageSummaries).orderBy((0, drizzle_orm_1.desc)(schema_1.messageSummaries.createdAt)).limit(1);
            if (summaries.length > 0) {
                const summary = summaries[0];
                return {
                    summary: summary.summary,
                    messageCount: summary.messageCount
                };
            }
            return null;
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