"use strict";
// Enhanced Drizzle Schema with Reasoning and Context Support
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationStats = exports.messages = exports.messageSummaries = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// Message summaries table
exports.messageSummaries = (0, pg_core_1.pgTable)('message_summaries', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    summary: (0, pg_core_1.text)('summary').notNull(),
    messageCount: (0, pg_core_1.integer)('message_count').notNull(),
    startTime: (0, pg_core_1.timestamp)('start_time', { withTimezone: true }).notNull(),
    endTime: (0, pg_core_1.timestamp)('end_time', { withTimezone: true }).notNull(),
    keyTopics: (0, pg_core_1.text)('key_topics').array(), // PostgreSQL array
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
    createdAtIdx: (0, pg_core_1.index)('idx_summaries_created_at').on(table.createdAt),
}));
// Enhanced messages table with reasoning support
exports.messages = (0, pg_core_1.pgTable)('messages', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    content: (0, pg_core_1.text)('content').notNull(),
    messageType: (0, pg_core_1.varchar)('message_type', { length: 20 }).notNull().$type(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow(),
    // Metadata for file modifications
    fileModifications: (0, pg_core_1.text)('file_modifications').array(),
    modificationApproach: (0, pg_core_1.varchar)('modification_approach', { length: 20 }).$type(),
    modificationSuccess: (0, pg_core_1.boolean)('modification_success'),
    // Enhanced reasoning and context fields
    reasoning: (0, pg_core_1.text)('reasoning'), // Claude's reasoning for decisions
    selectedFiles: (0, pg_core_1.text)('selected_files').array(), // Files that were selected
    errorDetails: (0, pg_core_1.text)('error_details'), // Detailed error information
    stepType: (0, pg_core_1.varchar)('step_type', { length: 50 }).$type(),
    // Modification details
    modificationRanges: (0, pg_core_1.text)('modification_ranges'), // JSON string of modification ranges
}, (table) => ({
    createdAtIdx: (0, pg_core_1.index)('idx_messages_created_at').on(table.createdAt.desc()),
    stepTypeIdx: (0, pg_core_1.index)('idx_messages_step_type').on(table.stepType),
}));
// Conversation stats table (single row)
exports.conversationStats = (0, pg_core_1.pgTable)('conversation_stats', {
    id: (0, pg_core_1.integer)('id').primaryKey().default(1),
    totalMessageCount: (0, pg_core_1.integer)('total_message_count').default(0),
    summaryCount: (0, pg_core_1.integer)('summary_count').default(0),
    lastMessageAt: (0, pg_core_1.timestamp)('last_message_at', { withTimezone: true }),
    lastModificationAt: (0, pg_core_1.timestamp)('last_modification_at', { withTimezone: true }),
    totalModifications: (0, pg_core_1.integer)('total_modifications').default(0),
    successfulModifications: (0, pg_core_1.integer)('successful_modifications').default(0),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow(),
});
//# sourceMappingURL=schema.js.map