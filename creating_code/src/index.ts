import Anthropic from "@anthropic-ai/sdk";
import { BackendSystemPrompt } from "./defaults/promt";
import { IntelligentFileModifier } from './services/filemodifier';
import axios from 'axios';
import "dotenv/config";
import * as fs from "fs";
import express from "express";
import path from "path";
import { DrizzleMessageHistoryDB } from './db/Messagesummary';
import AdmZip from "adm-zip";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic();
const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  // Allow requests from your frontend
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173'); // Vite dev server
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Your existing frontend system prompt
const pro = "Your existing frontend system prompt here..."; // Use your existing 'pro' variable

// Interfaces for TypeScript
interface FileData {
  path: string;
  content: string;
}

interface ConversationData {
  messages: any[];
  summaryCount: number;
  totalMessages: number;
}

// Simplified Conversation Helper (using your existing Drizzle methods)
class ConversationHelper {
  constructor(private messageDB: DrizzleMessageHistoryDB) {}

  async getEnhancedContext(): Promise<string> {
    // Use your existing getConversationContext method from DrizzleMessageHistoryDB
    return await this.messageDB.getConversationContext();
  }

  async getConversationWithSummary(): Promise<ConversationData> {
    // Use your existing getRecentConversation method
    const conversation = await this.messageDB.getRecentConversation();
    
    return {
      messages: conversation.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        metadata: {
          fileModifications: msg.fileModifications,
          modificationApproach: msg.modificationApproach,
          modificationSuccess: msg.modificationSuccess
        },
        createdAt: msg.createdAt
      })),
      summaryCount: conversation.summaryCount,
      totalMessages: conversation.totalMessages
    };
  }
}

// Database and services initialization
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DATABASE_URL = process.env.DATABASE_URL!;
const messageDB = new DrizzleMessageHistoryDB(DATABASE_URL, anthropic);
const conversationHelper = new ConversationHelper(messageDB);

async function initializeServices() {
  try {
    await messageDB.initializeStats();
    console.log('✅ Drizzle services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }
}

initializeServices();

// CORE ENDPOINTS

// Generate frontend code
app.post("/generateFrontend", async (req, res) => {
  const { prompt } = req.body;
  try {
    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-0",
      max_tokens: 20000,
      temperature: 1,
      system: pro,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }]
        }
      ]
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Frontend generation failed' });
  }
});

//@ts-ignore
app.post("/write-files", (req, res) => {
  const { files }: { files: FileData[] } = req.body;
  const baseDir = path.join(__dirname, "../react-base");

  if (!Array.isArray(files)) {
    return res.status(400).json({ error: "Invalid files array" });
  }

  try {
    files.forEach(({ path: filePath, content }) => {
      const fullPath = path.join(baseDir, filePath);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, content, "utf8");
    });

    res.json({ message: "Files written successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to write files" });
  }
});

// Generate changes with AST modification
app.post("/generateChanges", async (req, res) => {
  const { prompt } = req.body;
  
  try {
    const reactBasePath = path.join(__dirname, "../react-base");
    const intelligentModifier = new IntelligentFileModifier(anthropic, reactBasePath);
    const result = await intelligentModifier.processModification(prompt);
    
    if (result.success) {
      res.json({
        success: true,
        workflow: "8-step-ast-modification",
        selectedFiles: result.selectedFiles,
        approach: result.approach,
        modifiedRanges: result.modifiedRanges?.length || 0,
        details: {
          step1: "Project tree + metadata analyzed",
          step2: `Claude selected ${result.selectedFiles?.length || 0} relevant files`,
          step3: "Files parsed with AST to create detailed trees", 
          step4: "Claude pinpointed exact AST nodes needing modification",
          step5: "Code snippets extracted from target nodes",
          step6: "Claude modified the specific code snippets",
          step7: "Mapped AST nodes to exact source code ranges",
          step8: "Replaced code ranges with modified snippets"
        }
      });
    } else {
      res.status(400).json({
        success: false,
        workflow: "8-step-ast-modification",
        error: result.error || 'Modification workflow failed'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error during workflow'
    });
  }
});

//@ts-ignore
app.post("/modify-with-history-stream", async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: "Prompt is required"
    });
  }

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Credentials': 'true'
  });

  const sendEvent = (type: string, data: any) => {
    console.log(`📤 Sending ${type} event:`, data);
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent('progress', { 
      step: 1, 
      total: 8, 
      message: 'Initializing the intelligent modification system. Preparing to analyze your request and load conversation context for better understanding...' 
    });

    let enhancedPrompt = prompt;
    try {
      const context = await conversationHelper.getEnhancedContext();
      if (context) {
        enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
        sendEvent('progress', { 
          step: 2, 
          total: 8, 
          message: 'Successfully loaded previous conversation context! This includes past modifications, successful patterns, and project understanding. Using this context to provide more intelligent and consistent modifications...' 
        });
      } else {
        sendEvent('progress', { 
          step: 2, 
          total: 8, 
          message: 'No previous conversation context found. Starting with a fresh analysis of your request. This is normal for new conversations or after conversation resets...' 
        });
      }
    } catch (contextError) {
      sendEvent('progress', { 
        step: 2, 
        total: 8, 
        message: 'Encountered an issue while loading conversation context, but continuing with your original request. This won\'t affect the modification quality...' 
      });
    }

    const reactBasePath = path.join(__dirname, "../react-base");
    const intelligentModifier = new IntelligentFileModifier(anthropic, reactBasePath);
    
    //
    intelligentModifier.setStreamCallback((message: string) => {
      sendEvent('progress', { 
        step: 5, 
        total: 8, 
        message: message 
      });
    });

    sendEvent('progress', { 
      step: 3, 
      total: 8, 
      message: 'Intelligent file modifier initialized! Beginning comprehensive project analysis and modification workflow. This advanced system uses Abstract Syntax Tree parsing and AI-powered code generation for precise modifications...' 
    });

    const result = await intelligentModifier.processModification(enhancedPrompt);
    
    if (result.success) {
      sendEvent('progress', { 
        step: 7, 
        total: 8, 
        message: `Modification workflow completed successfully! Applied ${result.approach} modifications to ${result.selectedFiles?.length || 0} files. All changes have been written to disk and are now live in your application. Preparing final summary...` 
      });

      sendEvent('progress', { 
        step: 8, 
        total: 8, 
        message: 'Saving conversation history and modification metadata to database for future context. This helps improve subsequent modifications by understanding your project evolution and preferences...' 
      });

      // Send final result
      sendEvent('complete', {
        success: true,
        data: {
          workflow: "8-step-ast-modification-with-drizzle-history",
          selectedFiles: result.selectedFiles || [],
          approach: result.approach || 'UNKNOWN',
          modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (result.modifiedRanges?.length || 0),
          conversationContext: "Applied Drizzle conversation context with auto-summarization",
          reasoning: result.reasoning
        }
      });

    } else {
      sendEvent('progress', { 
        step: 6, 
        total: 8, 
        message: `The modification process encountered an issue: ${result.error}. This could be due to file structure differences, syntax problems, or the request not matching any existing components. Please check the error details and consider rephrasing your request...` 
      });

      sendEvent('error', {
        success: false,
        error: result.error || 'Modification failed'
      });
    }

  } catch (error: any) {
    console.error('❌ Streaming error:', error);
    sendEvent('progress', { 
      step: 0, 
      total: 8, 
      message: `An unexpected system error occurred: ${error.message}. This might be due to network connectivity, file system permissions, or AI service availability. Please try again, and if the problem persists, check your project structure and permissions...` 
    });
    
    sendEvent('error', {
      success: false,
      error: 'Internal server error during modification'
    });
  } finally {
    res.end();
  }
});

//@ts-ignore
app.post("/modify-with-history", async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: "Prompt is required"
      });
    }

    // Get enhanced context using your existing Drizzle methods
    let enhancedPrompt = prompt;
    try {
      const context = await conversationHelper.getEnhancedContext();
      if (context) {
        enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
      }
    } catch (contextError) {
      // Continue with original prompt if context loading fails
    }

    // Call generateChanges endpoint
    try {
      const response = await axios.post('http://localhost:3000/generateChanges', {
        prompt: enhancedPrompt
      }, {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      });

      if (response?.data?.success) {
        const data = response.data;
        return res.json({
          success: true,
          data: {
            workflow: "8-step-ast-modification-with-drizzle-history",
            selectedFiles: data.selectedFiles || [],
            approach: data.approach || 'UNKNOWN',
            modifiedRanges: typeof data.modifiedRanges === 'number' ? data.modifiedRanges : (data.modifiedRanges?.length || 0),
            conversationContext: "Applied Drizzle conversation context with auto-summarization"
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: response.data?.error || 'Modification failed'
        });
      }

    } catch (httpError: any) {
      if (httpError.response?.data) {
        return res.status(httpError.response.status || 500).json({
          success: false,
          error: httpError.response.data.error || 'generateChanges endpoint failed'
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to call generateChanges endpoint'
        });
      }
    }

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// MESSAGE MANAGEMENT ENDPOINTS (using your existing Drizzle methods)

//@ts-ignore
app.post("/messages", async (req, res) => {
  try {
    const { content, messageType, metadata } = req.body;
    
    if (!content || !messageType || !['user', 'assistant'].includes(messageType)) {
      return res.status(400).json({
        success: false,
        error: "Valid content and messageType required"
      });
    }

    const messageId = await messageDB.addMessage(content, messageType, metadata);
    
    res.json({
      success: true,
      data: { messageId, message: "Message added successfully" }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});

// Get conversation with summary (using your existing Drizzle methods)
app.get("/conversation-with-summary", async (req, res) => {
  try {
    const conversationData = await conversationHelper.getConversationWithSummary();
    res.json({
      success: true,
      data: conversationData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation'
    });
  }
});

// Get conversation stats
app.get("/conversation-stats", async (req, res) => {
  try {
    const stats = await messageDB.getConversationStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation stats'
    });
  }
});

// Get all summaries
app.get("/summaries", async (req, res) => {
  try {
    const summaries = await messageDB.getAllSummaries();
    res.json({
      success: true,
      data: summaries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get summaries'
    });
  }
});

// Clear all conversation data
app.delete("/conversation", async (req, res) => {
  try {
    await messageDB.clearAllData();
    res.json({
      success: true,
      data: { message: "All conversation data cleared successfully" }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation data'
    });
  }
});

// UTILITY ENDPOINTS

// Create project zip and upload to Supabase
app.get("/zipFolder", async (req, res) => {
  try {
    const zip = new AdmZip();
    const baseDir = path.join(__dirname, "../react-base");
    zip.addLocalFolder(baseDir);
    const outDir = path.join(__dirname, "../generated-sites", "proj123.zip");
    zip.writeZip(outDir);
    const zipData = fs.readFileSync(outDir);
    
    await supabase.storage
      .from("zipprojects")
      .upload("archives/proj123.zip", zipData, {
        contentType: "application/zip",
        upsert: true,
      });

    res.json("Project zipped and uploaded to Supabase successfully");
  } catch (error) {
    res.status(500).json({ error: 'Failed to zip and upload project' });
  }
});

app.get("/current-summary", async (req, res) => {
  try {
    console.log('🔍 /current-summary endpoint hit');
    
    const summary = await messageDB.getCurrentSummary();
    console.log('🔍 getCurrentSummary result:', summary);
    
    const recentConversation = await messageDB.getRecentConversation();
    console.log('🔍 getRecentConversation result:', recentConversation);
    
    // Calculate totalMessages correctly
    const summarizedCount = summary?.messageCount || 0;
    const recentCount = recentConversation.messages.length;
    const totalMessages = summarizedCount + recentCount;
    
    const responseData = {
      summary: summary?.summary || null,
      summarizedMessageCount: summarizedCount,
      recentMessageCount: recentCount,
      totalMessages: totalMessages, // Fix: Calculate correctly
      hasSummary: !!summary && !!summary.summary
    };
    
    console.log('🔍 Sending response:', responseData);
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ /current-summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current summary'
    });
  }
});

app.post("/fix-stats", async (req, res) => {
  try {
    await messageDB.fixConversationStats();
    const stats = await messageDB.getConversationStats();
    
    res.json({
      success: true,
      data: {
        message: "Stats fixed successfully",
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fix stats'
    });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});