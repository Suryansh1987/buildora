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
    const allMessages = await this.db.select().from(messages).orderBy(desc(messages.createdAt));

    if (allMessages.length > 5) {
      const recentMessages = allMessages.slice(0, 5);
      const oldMessages = allMessages.slice(5);

      if (oldMessages.length > 0) {
        // Update the single growing summary instead of creating new ones
        await this.updateGrowingSummary(oldMessages);
      }

      // Delete old messages (keep only recent 5)
      const oldMessageIds = oldMessages.map(m => m.id);
      for (const id of oldMessageIds) {
        await this.db.delete(messages).where(eq(messages.id, id));
      }
    }
  }
async fixConversationStats(): Promise<void> {
  try {
    // Count actual messages
    const allMessages = await this.db.select().from(messages);
    const messageCount = allMessages.length;
    
    // Count summaries
    const summaries = await this.db.select().from(messageSummaries);
    const summaryCount = summaries.length;
    
    // Get summary message count
    const latestSummary = summaries[0];
    const summarizedMessageCount = latestSummary?.messageCount || 0;
    
    // Calculate total messages
    const totalMessages = messageCount + summarizedMessageCount;
    
    // Update stats
    await this.db.update(conversationStats)
      .set({
        totalMessageCount: totalMessages,
        summaryCount: summaryCount > 0 ? 1 : 0, // Since we only keep one summary
        lastMessageAt: allMessages.length > 0 ? allMessages[allMessages.length - 1].createdAt : null,
        updatedAt: new Date()
      })
      .where(eq(conversationStats.id, 1));
      
    console.log(`✅ Fixed stats: ${totalMessages} total messages, ${summaryCount} summaries`);
  } catch (error) {
    console.error('Error fixing conversation stats:', error);
  }
}
  private async updateGrowingSummary(newMessages: Message[]): Promise<void> {
    // Get the existing summary
    const existingSummaries = await this.db.select().from(messageSummaries).orderBy(desc(messageSummaries.createdAt)).limit(1);
    const existingSummary = existingSummaries[0];

    // Generate new content to add to summary
    const { summary: newContent } = await this.generateSummaryUpdate(newMessages, existingSummary?.summary);

    if (existingSummary) {
      // Update existing summary by appending new content
      await this.db.update(messageSummaries)
        .set({
          summary: newContent,
          messageCount: existingSummary.messageCount + newMessages.length,
          endTime: newMessages[0].createdAt!, // Most recent time
          //@ts-ignore
          updatedAt: new Date()
        })
        .where(eq(messageSummaries.id, existingSummary.id));
    } else {
      // Create first summary
      const newSummary: NewMessageSummary = {
        summary: newContent,
        messageCount: newMessages.length,
        startTime: newMessages[newMessages.length - 1].createdAt!, // Oldest
        endTime: newMessages[0].createdAt!, // Newest
        keyTopics: ['react', 'file-modification'],
        createdAt: new Date()
      };
      await this.db.insert(messageSummaries).values(newSummary);
    }

    // Update summary count in stats
    if (!existingSummary) {
      await this.db.update(conversationStats)
        .set({
          summaryCount: 1,
          updatedAt: new Date()
        })
        .where(eq(conversationStats.id, 1));
    }
  }

  // Generate updated summary using Claude
  private async generateSummaryUpdate(newMessages: Message[], existingSummary?: string): Promise<{summary: string}> {
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
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 800,
        temperature: 0,
        messages: [{ role: 'user', content: claudePrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock?.type === 'text') {
        return { summary: firstBlock.text.trim() };
      }
    } catch (error) {
      console.error('Error generating summary update:', error);
    }

    // Fallback
    const fallbackSummary = existingSummary 
      ? `${existingSummary}\n\nAdditional changes: React modifications (${newMessages.length} more messages)`
      : `React development conversation (${newMessages.length} messages)`;
      
    return { summary: fallbackSummary };
  }

  // Get conversation context for file modification prompts
  async getConversationContext(): Promise<string> {
    // Get the single summary
    const summaries = await this.db.select().from(messageSummaries).orderBy(desc(messageSummaries.createdAt)).limit(1);
    
    // Get recent messages
    const recentMessages = await this.db.select().from(messages).orderBy(desc(messages.createdAt));

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

  // Get current summary for display - MOVED TO CORRECT CLASS
  async getCurrentSummary(): Promise<{summary: string; messageCount: number} | null> {
    const summaries = await this.db.select().from(messageSummaries).orderBy(desc(messageSummaries.createdAt)).limit(1);
    
    if (summaries.length > 0) {
      const summary = summaries[0];
      return {
        summary: summary.summary,
        messageCount: summary.messageCount
      };
    }
    
    return null;
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