"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const filemodifier_1 = require("./services/filemodifier");
const axios_1 = __importDefault(require("axios"));
require("dotenv/config");
const fs = __importStar(require("fs"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const Messagesummary_1 = require("./db/Messagesummary");
const adm_zip_1 = __importDefault(require("adm-zip"));
const cors_1 = __importDefault(require("cors"));
const supabase_js_1 = require("@supabase/supabase-js");
const anthropic = new sdk_1.default();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((req, res, next) => {
    // Allow requests from your frontend
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173'); // Vite dev server
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
// Your existing frontend system prompt
const pro = "Your existing frontend system prompt here..."; // Use your existing 'pro' variable
// Simplified Conversation Helper (using your existing Drizzle methods)
class ConversationHelper {
    constructor(messageDB) {
        this.messageDB = messageDB;
    }
    getEnhancedContext() {
        return __awaiter(this, void 0, void 0, function* () {
            // Use your existing getConversationContext method from DrizzleMessageHistoryDB
            return yield this.messageDB.getConversationContext();
        });
    }
    getConversationWithSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            // Use your existing getRecentConversation method
            const conversation = yield this.messageDB.getRecentConversation();
            return {
                messages: conversation.messages.map((msg) => ({
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
        });
    }
}
// Database and services initialization
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DATABASE_URL = process.env.DATABASE_URL;
const messageDB = new Messagesummary_1.DrizzleMessageHistoryDB(DATABASE_URL, anthropic);
const conversationHelper = new ConversationHelper(messageDB);
function initializeServices() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield messageDB.initializeStats();
            console.log('✅ Drizzle services initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize services:', error);
        }
    });
}
initializeServices();
// CORE ENDPOINTS
// Generate frontend code
app.post("/generateFrontend", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { prompt } = req.body;
    try {
        const result = yield anthropic.messages.create({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Frontend generation failed' });
    }
}));
//@ts-ignore
app.post("/write-files", (req, res) => {
    const { files } = req.body;
    const baseDir = path_1.default.join(__dirname, "../react-base");
    if (!Array.isArray(files)) {
        return res.status(400).json({ error: "Invalid files array" });
    }
    try {
        files.forEach(({ path: filePath, content }) => {
            const fullPath = path_1.default.join(baseDir, filePath);
            const dir = path_1.default.dirname(fullPath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fullPath, content, "utf8");
        });
        res.json({ message: "Files written successfully" });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to write files" });
    }
});
// Generate changes with AST modification
app.post("/generateChanges", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { prompt } = req.body;
    try {
        const reactBasePath = path_1.default.join(__dirname, "../react-base");
        const intelligentModifier = new filemodifier_1.IntelligentFileModifier(anthropic, reactBasePath);
        const result = yield intelligentModifier.processModification(prompt);
        if (result.success) {
            res.json({
                success: true,
                workflow: "8-step-ast-modification",
                selectedFiles: result.selectedFiles,
                approach: result.approach,
                modifiedRanges: ((_a = result.modifiedRanges) === null || _a === void 0 ? void 0 : _a.length) || 0,
                details: {
                    step1: "Project tree + metadata analyzed",
                    step2: `Claude selected ${((_b = result.selectedFiles) === null || _b === void 0 ? void 0 : _b.length) || 0} relevant files`,
                    step3: "Files parsed with AST to create detailed trees",
                    step4: "Claude pinpointed exact AST nodes needing modification",
                    step5: "Code snippets extracted from target nodes",
                    step6: "Claude modified the specific code snippets",
                    step7: "Mapped AST nodes to exact source code ranges",
                    step8: "Replaced code ranges with modified snippets"
                }
            });
        }
        else {
            res.status(400).json({
                success: false,
                workflow: "8-step-ast-modification",
                error: result.error || 'Modification workflow failed'
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Internal server error during workflow'
        });
    }
}));
//@ts-ignore
app.post("/modify-with-history-stream", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
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
    const sendEvent = (type, data) => {
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
            const context = yield conversationHelper.getEnhancedContext();
            if (context) {
                enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
                sendEvent('progress', {
                    step: 2,
                    total: 8,
                    message: 'Successfully loaded previous conversation context! This includes past modifications, successful patterns, and project understanding. Using this context to provide more intelligent and consistent modifications...'
                });
            }
            else {
                sendEvent('progress', {
                    step: 2,
                    total: 8,
                    message: 'No previous conversation context found. Starting with a fresh analysis of your request. This is normal for new conversations or after conversation resets...'
                });
            }
        }
        catch (contextError) {
            sendEvent('progress', {
                step: 2,
                total: 8,
                message: 'Encountered an issue while loading conversation context, but continuing with your original request. This won\'t affect the modification quality...'
            });
        }
        const reactBasePath = path_1.default.join(__dirname, "../react-base");
        const intelligentModifier = new filemodifier_1.IntelligentFileModifier(anthropic, reactBasePath);
        //
        intelligentModifier.setStreamCallback((message) => {
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
        const result = yield intelligentModifier.processModification(enhancedPrompt);
        if (result.success) {
            sendEvent('progress', {
                step: 7,
                total: 8,
                message: `Modification workflow completed successfully! Applied ${result.approach} modifications to ${((_a = result.selectedFiles) === null || _a === void 0 ? void 0 : _a.length) || 0} files. All changes have been written to disk and are now live in your application. Preparing final summary...`
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
                    modifiedRanges: typeof result.modifiedRanges === 'number' ? result.modifiedRanges : (((_b = result.modifiedRanges) === null || _b === void 0 ? void 0 : _b.length) || 0),
                    conversationContext: "Applied Drizzle conversation context with auto-summarization",
                    reasoning: result.reasoning
                }
            });
        }
        else {
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
    }
    catch (error) {
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
    }
    finally {
        res.end();
    }
}));
//@ts-ignore
app.post("/modify-with-history", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
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
            const context = yield conversationHelper.getEnhancedContext();
            if (context) {
                enhancedPrompt = `${context}\n\n--- CURRENT REQUEST ---\n${prompt}`;
            }
        }
        catch (contextError) {
            // Continue with original prompt if context loading fails
        }
        // Call generateChanges endpoint
        try {
            const response = yield axios_1.default.post('http://localhost:3000/generateChanges', {
                prompt: enhancedPrompt
            }, {
                timeout: 60000,
                headers: { 'Content-Type': 'application/json' }
            });
            if ((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.success) {
                const data = response.data;
                return res.json({
                    success: true,
                    data: {
                        workflow: "8-step-ast-modification-with-drizzle-history",
                        selectedFiles: data.selectedFiles || [],
                        approach: data.approach || 'UNKNOWN',
                        modifiedRanges: typeof data.modifiedRanges === 'number' ? data.modifiedRanges : (((_b = data.modifiedRanges) === null || _b === void 0 ? void 0 : _b.length) || 0),
                        conversationContext: "Applied Drizzle conversation context with auto-summarization"
                    }
                });
            }
            else {
                return res.status(400).json({
                    success: false,
                    error: ((_c = response.data) === null || _c === void 0 ? void 0 : _c.error) || 'Modification failed'
                });
            }
        }
        catch (httpError) {
            if ((_d = httpError.response) === null || _d === void 0 ? void 0 : _d.data) {
                return res.status(httpError.response.status || 500).json({
                    success: false,
                    error: httpError.response.data.error || 'generateChanges endpoint failed'
                });
            }
            else {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to call generateChanges endpoint'
                });
            }
        }
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}));
// MESSAGE MANAGEMENT ENDPOINTS (using your existing Drizzle methods)
//@ts-ignore
app.post("/messages", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { content, messageType, metadata } = req.body;
        if (!content || !messageType || !['user', 'assistant'].includes(messageType)) {
            return res.status(400).json({
                success: false,
                error: "Valid content and messageType required"
            });
        }
        const messageId = yield messageDB.addMessage(content, messageType, metadata);
        res.json({
            success: true,
            data: { messageId, message: "Message added successfully" }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to add message'
        });
    }
}));
// Get conversation with summary (using your existing Drizzle methods)
app.get("/conversation-with-summary", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const conversationData = yield conversationHelper.getConversationWithSummary();
        res.json({
            success: true,
            data: conversationData
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get conversation'
        });
    }
}));
// Get conversation stats
app.get("/conversation-stats", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stats = yield messageDB.getConversationStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get conversation stats'
        });
    }
}));
// Get all summaries
app.get("/summaries", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const summaries = yield messageDB.getAllSummaries();
        res.json({
            success: true,
            data: summaries
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get summaries'
        });
    }
}));
// Clear all conversation data
app.delete("/conversation", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield messageDB.clearAllData();
        res.json({
            success: true,
            data: { message: "All conversation data cleared successfully" }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to clear conversation data'
        });
    }
}));
// UTILITY ENDPOINTS
// Create project zip and upload to Supabase
app.get("/zipFolder", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const zip = new adm_zip_1.default();
        const baseDir = path_1.default.join(__dirname, "../react-base");
        zip.addLocalFolder(baseDir);
        const outDir = path_1.default.join(__dirname, "../generated-sites", "proj123.zip");
        zip.writeZip(outDir);
        const zipData = fs.readFileSync(outDir);
        yield supabase.storage
            .from("zipprojects")
            .upload("archives/proj123.zip", zipData, {
            contentType: "application/zip",
            upsert: true,
        });
        res.json("Project zipped and uploaded to Supabase successfully");
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to zip and upload project' });
    }
}));
app.get("/current-summary", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🔍 /current-summary endpoint hit');
        const summary = yield messageDB.getCurrentSummary();
        console.log('🔍 getCurrentSummary result:', summary);
        const recentConversation = yield messageDB.getRecentConversation();
        console.log('🔍 getRecentConversation result:', recentConversation);
        // Calculate totalMessages correctly
        const summarizedCount = (summary === null || summary === void 0 ? void 0 : summary.messageCount) || 0;
        const recentCount = recentConversation.messages.length;
        const totalMessages = summarizedCount + recentCount;
        const responseData = {
            summary: (summary === null || summary === void 0 ? void 0 : summary.summary) || null,
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
    }
    catch (error) {
        console.error('❌ /current-summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get current summary'
        });
    }
}));
app.post("/fix-stats", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield messageDB.fixConversationStats();
        const stats = yield messageDB.getConversationStats();
        res.json({
            success: true,
            data: {
                message: "Stats fixed successfully",
                stats
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fix stats'
        });
    }
}));
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
//# sourceMappingURL=index.js.map