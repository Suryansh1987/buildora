// Drizzle Database Client for Single User/Project Message History

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { 
  messages, 
  messageSummaries, 
  conversationStats,
  type Message, 
  type NewMessage, 
  type MessageSummary, 
  type NewMessageSummary,
  type ConversationStats 
} from './schema';

// Import the base class and types
import { IntelligentFileModifier, type ModificationResult } from '../services/filemodifier';

export class DrizzleMessageHistoryDB {
  private db: ReturnType<typeof drizzle>;
  private anthropic: Anthropic;

  constructor(databaseUrl: string, anthropic: Anthropic) {
    const sqlConnection = neon(databaseUrl);
    this.db = drizzle(sqlConnection);
    this.anthropic = anthropic;
  }

  // Initialize conversation stats if not exists
  async initializeStats(): Promise<void> {
    const existing = await this.db.select().from(conversationStats).where(eq(conversationStats.id, 1));
    
    if (existing.length === 0) {
      await this.db.insert(conversationStats).values({
        id: 1,
        totalMessageCount: 0,
        summaryCount: 0,
        lastMessageAt: null,
        updatedAt: new Date()
      });
    }
  }

  // Add a new message
  async addMessage(
    content: string,
    messageType: 'user' | 'assistant',
    metadata?: {
      fileModifications?: string[];
      modificationApproach?: 'FULL_FILE' | 'TARGETED_NODES';
      modificationSuccess?: boolean;
    }
  ): Promise<string> {
    const newMessage: NewMessage = {
      content,
      messageType,
      fileModifications: metadata?.fileModifications || null,
      modificationApproach: metadata?.modificationApproach || null,
      modificationSuccess: metadata?.modificationSuccess || null,
      createdAt: new Date()
    };

    // Insert the message
    const result = await this.db.insert(messages).values(newMessage).returning({ id: messages.id });
    const messageId = result[0].id;

    // Update conversation stats using SQL increment
    await this.db.update(conversationStats)
      .set({
        totalMessageCount: sql`${conversationStats.totalMessageCount} + 1`,
        lastMessageAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(conversationStats.id, 1));

    // Check if we need to summarize (keep only 5 recent messages)
    await this.maintainRecentMessages();

    return messageId;
  }

  // Maintain only 5 recent messages, summarize older ones
  private async maintainRecentMessages(): Promise<void> {
    // Get all messages ordered by creation time
    const allMessages = await this.db.select().from(messages).orderBy(desc(messages.createdAt));

    // If we have more than 5 messages, summarize the older ones
    if (allMessages.length > 5) {
      const recentMessages = allMessages.slice(0, 5);
      const oldMessages = allMessages.slice(5);

      // Create summary from old messages
      if (oldMessages.length > 0) {
        await this.createSummary(oldMessages);
      }

      // Delete old messages (keep only recent 5)
      const oldMessageIds = oldMessages.map(m => m.id);
      for (const id of oldMessageIds) {
        await this.db.delete(messages).where(eq(messages.id, id));
      }
    }
  }

  // Create a summary from old messages using Claude
  private async createSummary(oldMessages: Message[]): Promise<void> {
    const { summary, keyTopics } = await this.generateSummary(oldMessages);

    const newSummary: NewMessageSummary = {
      summary,
      messageCount: oldMessages.length,
      startTime: oldMessages[oldMessages.length - 1].createdAt!, // Oldest first
      endTime: oldMessages[0].createdAt!, // Newest first
      keyTopics,
      createdAt: new Date()
    };

    await this.db.insert(messageSummaries).values(newSummary);

    // Update summary count in stats using SQL increment
    await this.db.update(conversationStats)
      .set({
        summaryCount: sql`${conversationStats.summaryCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(conversationStats.id, 1));
  }

  // Generate summary using Claude
  private async generateSummary(oldMessages: Message[]): Promise<{summary: string, keyTopics: string[]}> {
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
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 500,
        temperature: 0,
        messages: [{ role: 'user', content: claudePrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        const text = firstBlock.text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]) as { summary: string; keyTopics: string[] };
          return {
            summary: result.summary,
            keyTopics: result.keyTopics || []
          };
        }
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    }

    // Fallback summary
    return {
      summary: `React modification conversation (${oldMessages.length} messages)`,
      keyTopics: ['react', 'file-modification']
    };
  }

  // Get conversation context for file modification prompts
  async getConversationContext(): Promise<string> {
    // Get summaries
    const summaries = await this.db.select().from(messageSummaries).orderBy(desc(messageSummaries.createdAt));
    
    // Get recent messages
    const recentMessages = await this.db.select().from(messages).orderBy(desc(messages.createdAt));

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
  }

  // Get recent conversation for display
  async getRecentConversation(): Promise<{
    messages: Message[];
    summaryCount: number;
    totalMessages: number;
  }> {
    // Get recent messages
    const recentMessages = await this.db.select().from(messages).orderBy(desc(messages.createdAt));

    // Get stats
    const stats = await this.db.select().from(conversationStats).where(eq(conversationStats.id, 1));
    const currentStats = stats[0] || { totalMessageCount: 0, summaryCount: 0 };

    return {
      messages: recentMessages,
      summaryCount: currentStats.summaryCount || 0,
      totalMessages: currentStats.totalMessageCount || 0
    };
  }

  // Get conversation stats
  async getConversationStats(): Promise<ConversationStats | null> {
    const stats = await this.db.select().from(conversationStats).where(eq(conversationStats.id, 1));
    return stats[0] || null;
  }

  // Get all summaries
  async getAllSummaries(): Promise<MessageSummary[]> {
    return await this.db.select().from(messageSummaries).orderBy(desc(messageSummaries.createdAt));
  }

  // Clear all conversation data (for testing/reset)
  async clearAllData(): Promise<void> {
    await this.db.delete(messages);
    await this.db.delete(messageSummaries);
    await this.db.update(conversationStats)
      .set({
        totalMessageCount: 0,
        summaryCount: 0,
        lastMessageAt: null,
        updatedAt: new Date()
      })
      .where(eq(conversationStats.id, 1));
  }
}

// Usage with IntelligentFileModifier
export class IntelligentFileModifierWithDrizzle extends IntelligentFileModifier {
  private messageDB: DrizzleMessageHistoryDB;

  constructor(
    anthropic: Anthropic, 
    reactBasePath: string, 
    databaseUrl: string
  ) {
    super(anthropic, reactBasePath);
    this.messageDB = new DrizzleMessageHistoryDB(databaseUrl, anthropic);
  }

  // Initialize the database
  async initialize(): Promise<void> {
    await this.messageDB.initializeStats();
  }

  // Process modification with message history
  async processModificationWithHistory(prompt: string): Promise<ModificationResult> {
    // Add user message
    await this.messageDB.addMessage(prompt, 'user');

    // Get conversation context
    const context = await this.messageDB.getConversationContext();

    // Modify the prompt to include context
    const enhancedPrompt = context ? `${context}\n\n**Current Request:** ${prompt}` : prompt;

    // Process the modification with enhanced context
    const result = await this.processModification(enhancedPrompt);

    // Add assistant response
    const assistantResponse = result.success 
      ? `Successfully modified ${result.selectedFiles?.length || 0} files using ${result.approach} approach.`
      : `Failed to modify files: ${result.error}`;

    await this.messageDB.addMessage(
      assistantResponse, 
      'assistant',
      {
        fileModifications: result.selectedFiles,
        modificationApproach: result.approach,
        modificationSuccess: result.success
      }
    );

    return result;
  }

  // Get conversation for display
  async getConversationForDisplay(): Promise<{
    messages: Message[];
    summaryCount: number;
    totalMessages: number;
  }> {
    return await this.messageDB.getRecentConversation();
  }

  // Get conversation stats
  async getStats(): Promise<ConversationStats | null> {
    return await this.messageDB.getConversationStats();
  }
}