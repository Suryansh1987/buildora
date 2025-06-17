"use strict";
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
exports.IntelligentFileModifier = void 0;
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const fs_1 = require("fs");
const path_1 = require("path");
const filetree_1 = require("./filetree"); // or '../filetree' depending on location
class IntelligentFileModifier {
    constructor(anthropic, reactBasePath) {
        this.anthropic = anthropic;
        this.reactBasePath = reactBasePath;
        this.projectFiles = new Map();
    }
    // Set streaming callback
    setStreamCallback(callback) {
        this.streamCallback = callback;
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    buildProjectTree() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('Starting project analysis... Scanning the src directory for React components, TypeScript files, and project structure.');
            const srcPath = (0, path_1.join)(this.reactBasePath, 'src');
            try {
                yield fs_1.promises.access(srcPath);
                this.streamUpdate('Found src directory! Beginning deep scan of all React files (.js, .jsx, .ts, .tsx) while excluding node_modules and hidden directories.');
            }
            catch (error) {
                this.streamUpdate('No src directory found. This might not be a React project or the structure is different than expected.');
                return;
            }
            const scanDir = (dir_1, ...args_1) => __awaiter(this, [dir_1, ...args_1], void 0, function* (dir, relativePath = '') {
                try {
                    const entries = yield fs_1.promises.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = (0, path_1.join)(dir, entry.name);
                        const relPath = relativePath ? (0, path_1.join)(relativePath, entry.name) : entry.name;
                        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                            this.streamUpdate(`📁 Exploring directory: ${relPath}/ - scanning for React components and related files...`);
                            yield scanDir(fullPath, relPath);
                        }
                        else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
                            this.streamUpdate(`🔍 Analyzing file: ${relPath} - extracting component metadata, button detection, and code structure...`);
                            yield this.analyzeFile(fullPath, relPath);
                        }
                    }
                }
                catch (error) {
                    this.streamUpdate(`⚠️ Error scanning directory ${dir}: ${error}. Continuing with other directories...`);
                    console.error(`Error scanning directory ${dir}:`, error);
                }
            });
            yield scanDir(srcPath);
            this.streamUpdate(`✅ Project scan complete! Found ${this.projectFiles.size} React files. Building comprehensive metadata including component names, button detection, signin patterns, and file relationships.`);
        });
    }
    analyzeFile(filePath, relativePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (relativePath.includes('components/ui/') || relativePath.includes('components\\ui\\')) {
                    return;
                }
                const content = yield fs_1.promises.readFile(filePath, 'utf8');
                const stats = yield fs_1.promises.stat(filePath);
                const lines = content.split('\n');
                const projectFile = {
                    name: (0, path_1.basename)(filePath),
                    path: filePath,
                    relativePath: `src/${relativePath}`,
                    content,
                    lines: lines.length,
                    size: stats.size,
                    snippet: lines.slice(0, 15).join('\n'),
                    componentName: this.extractComponentName(content),
                    hasButtons: this.checkForButtons(content),
                    hasSignin: this.checkForSignin(content),
                    isMainFile: this.isMainFile(filePath, content)
                };
                this.projectFiles.set(projectFile.relativePath, projectFile);
            }
            catch (error) {
                console.error(`Failed to analyze file ${relativePath}:`, error);
            }
        });
    }
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    fallbackFileSearch(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.projectFiles.size === 0) {
                return [];
            }
            const searchTerms = prompt.toLowerCase().split(' ').filter(term => term.length > 2);
            const matches = [];
            for (const [relativePath, file] of this.projectFiles.entries()) {
                let score = 0;
                const fileContentLower = file.content.toLowerCase();
                searchTerms.forEach(term => {
                    if (term.length > 2) {
                        const contentMatches = (fileContentLower.match(new RegExp(this.escapeRegExp(term), 'g')) || []).length;
                        if (contentMatches > 0 && contentMatches < 100) {
                            score += Math.min(contentMatches * 10, 100);
                        }
                        if (file.name.toLowerCase().includes(term)) {
                            score += 20;
                        }
                    }
                });
                if (prompt.includes('signin') || prompt.includes('login') || prompt.includes('sign in')) {
                    if (file.hasSignin) {
                        score += 50;
                    }
                    if (file.hasButtons) {
                        score += 25;
                    }
                }
                if (prompt.includes('button')) {
                    if (file.hasButtons) {
                        score += 40;
                    }
                }
                if (file.isMainFile) {
                    score += 10;
                }
                if (score > 20) {
                    matches.push({ file, score });
                }
            }
            if (matches.length > 0) {
                matches.sort((a, b) => b.score - a.score);
                const topMatches = matches.slice(0, 3);
                return topMatches.map(m => m.file.relativePath);
            }
            return [];
        });
    }
    determineScopeForFallbackFiles(prompt, files) {
        return __awaiter(this, void 0, void 0, function* () {
            const claudePrompt = `
**User Request:** "${prompt}"
**Files Found:** ${files.join(', ')}

**Task:** Determine the modification scope based ONLY on the request type.

**Scope Guidelines:**
- **FULL_FILE**: Use when request involves:
  * Dark mode, theme changes, color scheme overhauls
  * Layout changes, design changes, comprehensive styling
  * Complete redesigns, modernization, overhauls
  * Adding responsive design, mobile layouts
  * Structural changes affecting entire components
  * Any request mentioning "entire", "all", "complete", "comprehensive"

- **TARGETED_NODES**: Use when request involves:
  * Specific button colors (e.g., "make signin button red")
  * Individual text changes
  * Single element modifications
  * Small styling tweaks to specific elements
  * Adding/removing specific attributes

**Examples:**
- "make signin button red" → TARGETED_NODES
- "add dark mode theme" → FULL_FILE
- "change layout to modern design" → FULL_FILE
- "make header responsive" → FULL_FILE
- "change text color of welcome message" → TARGETED_NODES

**Response:** Return ONLY the scope:
TARGETED_NODES
    `.trim();
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 50,
                    temperature: 0,
                    messages: [{ role: 'user', content: claudePrompt }],
                });
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text.trim();
                    if (text.includes('FULL_FILE')) {
                        return 'FULL_FILE';
                    }
                }
                return 'TARGETED_NODES';
            }
            catch (error) {
                console.error('Error determining scope:', error);
                return 'TARGETED_NODES';
            }
        });
    }
    handleFullFileModification(prompt, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.projectFiles.get(filePath);
            if (!file) {
                return false;
            }
            const claudePrompt = `
**User Request:** "${prompt}"

**Current File Content:**
\`\`\`jsx
${file.content}
\`\`\`

**Task:** Rewrite the entire file according to the request. Preserve functionality but apply comprehensive changes.

**Response:** Return only the complete modified file:
\`\`\`jsx
[complete file content here]
\`\`\`
    `.trim();
            try {
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 4000,
                    temperature: 0,
                    messages: [{ role: 'user', content: claudePrompt }],
                });
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const codeMatch = text.match(/```jsx\n([\s\S]*?)```/) || text.match(/```tsx\n([\s\S]*?)```/);
                    if (codeMatch) {
                        const modifiedContent = codeMatch[1].trim();
                        yield fs_1.promises.writeFile(file.path, modifiedContent, 'utf8');
                        return true;
                    }
                }
                return false;
            }
            catch (error) {
                console.error(`Error in full file modification for ${filePath}:`, error);
                return false;
            }
        });
    }
    extractComponentName(content) {
        const match = content.match(/(?:function|const|class)\s+(\w+)/) ||
            content.match(/export\s+default\s+(\w+)/);
        return match ? match[1] : null;
    }
    checkForButtons(content) {
        return /button|Button|btn|<button|type.*submit/i.test(content);
    }
    checkForSignin(content) {
        return /signin|sign.?in|login|log.?in|auth/i.test(content);
    }
    isMainFile(filePath, content) {
        const fileName = (0, path_1.basename)(filePath).toLowerCase();
        const isMainName = /^(app|index|main|home)\./.test(fileName);
        const hasMainContent = /export\s+default|function\s+App|class\s+App/i.test(content);
        return isMainName || hasMainContent;
    }
    buildProjectSummary() {
        let summary = "**PROJECT FILE TREE + METADATA:**\n\n";
        const sortedFiles = Array.from(this.projectFiles.values())
            .sort((a, b) => {
            if (a.isMainFile && !b.isMainFile)
                return -1;
            if (!a.isMainFile && b.isMainFile)
                return 1;
            if (a.hasSignin && !b.hasSignin)
                return -1;
            if (!a.hasSignin && b.hasSignin)
                return 1;
            return a.relativePath.localeCompare(b.relativePath);
        });
        sortedFiles.forEach(file => {
            summary += `**${file.relativePath}**\n`;
            summary += `- Size: ${file.size} bytes, ${file.lines} lines\n`;
            summary += `- Component: ${file.componentName || 'Unknown'}\n`;
            summary += `- Has buttons: ${file.hasButtons ? 'Yes' : 'No'}\n`;
            summary += `- Has signin: ${file.hasSignin ? 'Yes' : 'No'}\n`;
            summary += `- Is main file: ${file.isMainFile ? 'Yes' : 'No'}\n`;
            summary += `- Code preview:\n\`\`\`\n${file.snippet}\n\`\`\`\n\n`;
        });
        return summary;
    }
    identifyRelevantFiles(prompt, conversationContext) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🤖 Calling Claude AI to analyze your request and determine which files need modification. This involves understanding the intent, mapping to project structure, and deciding on modification scope...');
            const projectSummary = this.buildProjectSummary();
            this.streamUpdate('📊 Built comprehensive project summary with file metadata. Now sending to Claude AI for intelligent file selection and scope determination...');
            const claudePrompt = `
You are analyzing a React project to determine which files need modification AND the scope of changes.

${conversationContext ? `**Conversation Context:**
${conversationContext}

` : ''}**Current User Request:** "${prompt}"

${projectSummary}
**File Structure:** "${filetree_1.structure}"
**Your Task:** 
1. Determine which file(s) are relevant for this modification request
2. **CRITICALLY IMPORTANT**: Determine the modification scope based on the request
3. Consider previous conversation context when making decisions

**Scope Guidelines (VERY IMPORTANT):**
- **FULL_FILE**: Use when request involves:
  * Dark mode, theme changes, color scheme overhauls
  * Layout changes, design changes, comprehensive styling
  * Complete redesigns, modernization, overhauls
  * Adding responsive design, mobile layouts
  * Structural changes affecting entire components
  * Any request mentioning "entire", "all", "complete", "comprehensive"
  * Building on previous comprehensive changes mentioned in context

- **TARGETED_NODES**: Use when request involves:
  * Specific button colors (e.g., "make signin button red")
  * Individual text changes
  * Single element modifications
  * Small styling tweaks to specific elements
  * Adding/removing specific attributes
  * Minor adjustments to previously modified elements

**File Selection Guidelines:**
- For signin/login requests: Look for files with signin content
- For button styling: Look for files with buttons  
- For layout/theme changes: Focus on main app files
- Consider files mentioned in conversation context as candidates
- You can select multiple files if the change affects multiple components
- NEVER select files from components/ui/ folder (these are UI library components)
- If context shows recent modifications to specific files, consider if current request relates to them

**Context Awareness:**
- If previous messages mention specific files being modified, consider their relevance
-Don't Import anything on your own
- If user is building on previous changes (e.g., "also make the header darker" after dark mode), maintain consistency
- If previous attempts failed on certain files, consider alternative files
- Learn from successful modification patterns in the conversation

**Examples:**
- "make signin button red" → TARGETED_NODES
- "add dark mode theme" or "mock data addition" → FULL_FILE
- "change layout to modern design" → FULL_FILE
- "make header responsive" → FULL_FILE
- "change text color of welcome message" → TARGETED_NODES
- "also make the buttons bigger" (after button color changes) → TARGETED_NODES
- "make the whole app dark" (following previous dark mode work) → FULL_FILE

**Response Format:** Return ONLY this JSON:
\`\`\`json
{
  "files": ["src/App.tsx", "src/components/LoginForm.tsx"],
  "scope": "FULL_FILE",
  "reasoning": "Brief explanation of file selection and scope decision based on request and context"
}
\`\`\`

**CRITICAL**: Pay special attention to scope determination and conversation context - this controls the entire workflow!

Return ONLY the JSON, no explanations outside the reasoning field.
    `.trim();
            try {
                this.streamUpdate('⚡ Claude AI is processing your request... Analyzing project structure, understanding intent, and making intelligent decisions about file modifications...');
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 500,
                    temperature: 0,
                    messages: [{ role: 'user', content: claudePrompt }],
                });
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const jsonMatch = text.match(/```json\n([\s\S]*?)```/);
                    if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[1]);
                        this.streamUpdate(`✅ Claude AI analysis complete! Selected ${result.files.length} files for ${result.scope} modification approach. Reasoning: ${result.reasoning}`);
                        return {
                            files: result.files,
                            scope: result.scope,
                            reasoning: result.reasoning
                        };
                    }
                }
                this.streamUpdate('⚠️ Claude AI response parsing failed. Falling back to default file selection strategy...');
                return { files: [], scope: 'TARGETED_NODES' };
            }
            catch (error) {
                this.streamUpdate(`❌ Error during Claude AI file identification: ${error}. Attempting fallback search methods...`);
                console.error('Error in file identification:', error);
                return { files: [], scope: 'TARGETED_NODES' };
            }
        });
    }
    parseFileWithAST(filePath) {
        this.streamUpdate(`🔬 Parsing ${filePath} with Abstract Syntax Tree (AST) analysis. Converting React/TypeScript code into analyzable tree structure to identify precise modification targets...`);
        const file = this.projectFiles.get(filePath);
        if (!file) {
            this.streamUpdate(`⚠️ File ${filePath} not found in project files map. Skipping AST parsing...`);
            return [];
        }
        try {
            this.streamUpdate(`📝 Using Babel parser with JSX and TypeScript plugins to create AST. This allows surgical precision in code modifications rather than string replacements...`);
            const ast = (0, parser_1.parse)(file.content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
            });
            const nodes = [];
            let nodeId = 1;
            const lines = file.content.split('\n');
            this.streamUpdate(`🔍 Traversing AST to find JSX elements (React components). Each element will be cataloged with its location, content, attributes, and modification potential...`);
            (0, traverse_1.default)(ast, {
                JSXElement(path) {
                    var _a, _b, _c, _d;
                    const node = path.node;
                    let tagName = 'unknown';
                    if (node.openingElement.name.type === 'JSXIdentifier') {
                        tagName = node.openingElement.name.name;
                    }
                    let textContent = '';
                    if (node.children) {
                        node.children.forEach((child) => {
                            if (child.type === 'JSXText') {
                                textContent += child.value.trim() + ' ';
                            }
                        });
                    }
                    const startLine = ((_a = node.loc) === null || _a === void 0 ? void 0 : _a.start.line) || 1;
                    const endLine = ((_b = node.loc) === null || _b === void 0 ? void 0 : _b.end.line) || 1;
                    const startColumn = ((_c = node.loc) === null || _c === void 0 ? void 0 : _c.start.column) || 0;
                    const endColumn = ((_d = node.loc) === null || _d === void 0 ? void 0 : _d.end.column) || 0;
                    const codeSnippet = lines.slice(startLine - 1, endLine).join('\n');
                    const contextStart = Math.max(0, startLine - 4);
                    const contextEnd = Math.min(lines.length, endLine + 3);
                    const fullContext = lines.slice(contextStart, contextEnd).join('\n');
                    const attributes = [];
                    if (node.openingElement.attributes) {
                        node.openingElement.attributes.forEach((attr) => {
                            if (attr.type === 'JSXAttribute' && attr.name) {
                                attributes.push(attr.name.name);
                            }
                        });
                    }
                    nodes.push({
                        id: `node_${nodeId++}`,
                        type: 'JSXElement',
                        tagName,
                        textContent: textContent.trim(),
                        startLine,
                        endLine,
                        startColumn,
                        endColumn,
                        codeSnippet,
                        fullContext,
                        isButton: tagName.toLowerCase().includes('button'),
                        hasSigninText: /sign\s*in|log\s*in|login|signin/i.test(textContent),
                        attributes
                    });
                }
            });
            this.streamUpdate(`✅ AST parsing complete for ${filePath}! Found ${nodes.length} JSX elements including ${nodes.filter(n => n.isButton).length} button elements and ${nodes.filter(n => n.hasSigninText).length} signin-related elements.`);
            return nodes;
        }
        catch (error) {
            this.streamUpdate(`❌ AST parsing failed for ${filePath}: ${error}. This file may have syntax errors or unsupported syntax. Skipping...`);
            console.error(`Error parsing ${filePath}:`, error);
            return [];
        }
    }
    identifyTargetNodes(prompt, filePath, nodes) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate(`🎯 Using Claude AI to identify specific target nodes in ${filePath}. Analyzing ${nodes.length} JSX elements to find exact components that need modification...`);
            const nodesPreview = nodes.map(node => `**${node.id}:** <${node.tagName}> "${node.textContent}" (lines ${node.startLine}-${node.endLine})${node.isButton ? ' [BUTTON]' : ''}${node.hasSigninText ? ' [SIGNIN]' : ''}`).join('\n');
            const claudePrompt = `
**User Request:** "${prompt}"
**File:** ${filePath}

**Available AST Nodes:**
${nodesPreview}

**Task:** Identify which specific AST nodes need modification for this request.

**Guidelines:**
- For "make signin button red": Look for button nodes with signin text
- For styling changes: Find the specific elements that need styling
- Be precise - only select nodes that actually need to change

**Response Format:** Return ONLY a JSON array of node IDs:
\`\`\`json
["node_5", "node_12"]
\`\`\`

If no nodes need changes, return: []
    `.trim();
            try {
                this.streamUpdate(`🤖 Claude AI is analyzing the AST nodes to determine which specific elements match your request. This ensures precise targeting without affecting unrelated code...`);
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 200,
                    temperature: 0,
                    messages: [{ role: 'user', content: claudePrompt }],
                });
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    const match = text.match(/\[(.*?)\]/);
                    if (match) {
                        const nodeIds = JSON.parse(`[${match[1]}]`);
                        const targetNodes = nodes.filter(node => nodeIds.includes(node.id));
                        this.streamUpdate(`✅ Target identification complete! Selected ${targetNodes.length} specific nodes for modification: ${targetNodes.map(n => `${n.tagName}(${n.id})`).join(', ')}`);
                        return targetNodes;
                    }
                }
                this.streamUpdate('⚠️ No specific target nodes identified by Claude AI. This might mean the request doesn\'t match any elements in this file.');
                return [];
            }
            catch (error) {
                this.streamUpdate(`❌ Error during target node identification: ${error}. Skipping this file...`);
                console.error('Error identifying target nodes:', error);
                return [];
            }
        });
    }
    modifyCodeSnippets(prompt, targetNodes) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate(`🔧 Claude AI is now modifying the specific code snippets for ${targetNodes.length} target nodes. This involves understanding the current code structure and applying your requested changes while maintaining functionality...`);
            const snippetsInfo = targetNodes.map(node => `**${node.id}:** (lines ${node.startLine}-${node.endLine})
\`\`\`jsx
${node.codeSnippet}
\`\`\`

Context:
\`\`\`jsx
${node.fullContext}
\`\`\`
`).join('\n\n');
            const claudePrompt = `
**User Request:** "${prompt}"

**Code Snippets to Modify:**
${snippetsInfo}

**Task:** Modify each code snippet according to the request. Return the exact replacement code for each node.

**IMPORTANT**: You must return a valid JSON object with node IDs as keys and modified JSX code as values.

**Response Format:** Return ONLY this JSON (no other text):
\`\`\`json
{
  "node_5": "<modified JSX code here>",
  "node_12": "<modified JSX code here>"
}
\`\`\`

**Example for "make button red":**
\`\`\`json
{
  "node_15": "<button className=\"bg-red-500 text-white px-4 py-2 rounded\">Submit</button>"
}
\`\`\`

Return ONLY the JSON, nothing else.
    `.trim();
            try {
                this.streamUpdate(`⚡ Sending code snippets to Claude AI for modification. The AI will analyze each snippet, understand the styling framework (Tailwind/CSS), and apply your requested changes appropriately...`);
                const response = yield this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20240620',
                    max_tokens: 2000,
                    temperature: 0,
                    messages: [{ role: 'user', content: claudePrompt }],
                });
                const firstBlock = response.content[0];
                if ((firstBlock === null || firstBlock === void 0 ? void 0 : firstBlock.type) === 'text') {
                    const text = firstBlock.text;
                    let jsonMatch = text.match(/```json\n([\s\S]*?)```/);
                    if (!jsonMatch) {
                        jsonMatch = text.match(/```\n([\s\S]*?)```/);
                    }
                    if (!jsonMatch) {
                        jsonMatch = text.match(/\{[\s\S]*\}/);
                    }
                    if (jsonMatch) {
                        try {
                            const jsonText = jsonMatch[1] || jsonMatch[0];
                            const modifications = JSON.parse(jsonText);
                            const modMap = new Map();
                            for (const [nodeId, modifiedCode] of Object.entries(modifications)) {
                                if (typeof modifiedCode === 'string' && modifiedCode.trim()) {
                                    modMap.set(nodeId, modifiedCode);
                                }
                            }
                            this.streamUpdate(`✅ Code modification complete! Generated ${modMap.size} modified code snippets. Each modification preserves the original structure while applying your requested changes.`);
                            return modMap;
                        }
                        catch (parseError) {
                            this.streamUpdate(`❌ Failed to parse Claude AI's modification response: ${parseError}. The AI response might be malformed.`);
                            console.error('JSON parsing failed:', parseError);
                        }
                    }
                }
                this.streamUpdate('⚠️ No valid modifications received from Claude AI. This might indicate the request couldn\'t be applied to the selected code snippets.');
                return new Map();
            }
            catch (error) {
                this.streamUpdate(`❌ Error during code snippet modification: ${error}. This could be a connectivity issue or AI service problem.`);
                console.error('Error modifying code snippets:', error);
                return new Map();
            }
        });
    }
    applyModifications(filePath, targetNodes, modifications) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate(`💾 Applying ${modifications.size} code modifications to ${filePath}. This involves carefully replacing the exact AST node ranges with the new code while preserving file structure...`);
            const file = this.projectFiles.get(filePath);
            if (!file) {
                this.streamUpdate(`❌ File ${filePath} not found in project files. Cannot apply modifications.`);
                return false;
            }
            let modifiedContent = file.content;
            const lines = modifiedContent.split('\n');
            this.streamUpdate(`📝 Sorting modifications by line number (bottom to top) to ensure line numbers remain valid during replacement process...`);
            const sortedNodes = targetNodes
                .filter(node => modifications.has(node.id))
                .sort((a, b) => b.startLine - a.startLine);
            this.streamUpdate(`🔄 Processing ${sortedNodes.length} modifications in reverse order to maintain line integrity...`);
            for (const node of sortedNodes) {
                const modifiedCode = modifications.get(node.id);
                if (modifiedCode) {
                    const startIndex = node.startLine - 1;
                    const endIndex = node.endLine - 1;
                    const newLines = modifiedCode.split('\n');
                    this.streamUpdate(`📍 Replacing lines ${node.startLine}-${node.endLine} in ${filePath} with ${newLines.length} new lines of code...`);
                    lines.splice(startIndex, endIndex - startIndex + 1, ...newLines);
                }
            }
            modifiedContent = lines.join('\n');
            try {
                this.streamUpdate(`💿 Writing modified content back to ${filePath}. Total size: ${modifiedContent.length} characters across ${lines.length} lines...`);
                yield fs_1.promises.writeFile(file.path, modifiedContent, 'utf8');
                this.streamUpdate(`✅ Successfully saved ${filePath}! All modifications have been applied and the file is ready for use.`);
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ Failed to save ${filePath}: ${error}. Check file permissions and disk space.`);
                console.error(`Failed to save ${filePath}:`, error);
                return false;
            }
        });
    }
    processModification(prompt, conversationContext) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.streamUpdate('🚀 Starting intelligent file modification workflow. This process uses advanced AST analysis and AI-powered code generation to make precise changes to your React application...');
                yield this.buildProjectTree();
                if (this.projectFiles.size === 0) {
                    this.streamUpdate('❌ No React files found in the project. Make sure you have a valid React project with a src directory containing .js, .jsx, .ts, or .tsx files.');
                    return { success: false, error: 'No React files found in project' };
                }
                this.streamUpdate('🔍 Determining relevant files and modification scope based on your request and conversation context...');
                let fileAnalysis = yield this.identifyRelevantFiles(prompt, conversationContext);
                if (fileAnalysis.files.length === 0) {
                    this.streamUpdate('⚠️ Primary file identification found no matches. Attempting fallback search using keyword matching and pattern recognition...');
                    const fallbackFiles = yield this.fallbackFileSearch(prompt);
                    if (fallbackFiles.length > 0) {
                        this.streamUpdate(`🔄 Fallback search successful! Found ${fallbackFiles.length} potential files. Determining modification scope...`);
                        const scope = yield this.determineScopeForFallbackFiles(prompt, fallbackFiles);
                        fileAnalysis = { files: fallbackFiles, scope };
                    }
                    else {
                        this.streamUpdate('❌ Even fallback search couldn\'t find relevant files. Your request might not match any existing components or the project structure might be different than expected.');
                        return { success: false, error: 'No relevant files found even after fallback search' };
                    }
                }
                if (fileAnalysis.files.length === 0) {
                    return { success: false, error: 'No relevant files found even after fallback search' };
                }
                const { files: relevantFiles, scope } = fileAnalysis;
                this.streamUpdate(`📋 Processing ${relevantFiles.length} files using ${scope} approach: ${relevantFiles.join(', ')}`);
                if (scope === 'FULL_FILE') {
                    this.streamUpdate('🔧 Using FULL_FILE modification approach. This will rewrite entire files while preserving functionality. Suitable for comprehensive changes like themes, layouts, or major restructuring...');
                    let successCount = 0;
                    for (const filePath of relevantFiles) {
                        this.streamUpdate(`📄 Processing full file modification for ${filePath}...`);
                        const success = yield this.handleFullFileModification(prompt, filePath);
                        if (success) {
                            this.streamUpdate(`✅ Successfully completed full file modification for ${filePath}`);
                            successCount++;
                        }
                        else {
                            this.streamUpdate(`❌ Full file modification failed for ${filePath}`);
                        }
                    }
                    if (successCount > 0) {
                        this.streamUpdate(`🎉 Full file modification workflow complete! Successfully modified ${successCount} out of ${relevantFiles.length} files. Your changes are now live!`);
                        return {
                            success: true,
                            selectedFiles: relevantFiles,
                            approach: 'FULL_FILE',
                            reasoning: fileAnalysis.reasoning,
                            modifiedRanges: [{
                                    file: relevantFiles.join(', '),
                                    range: {
                                        startLine: 1,
                                        endLine: 9999,
                                        startColumn: 0,
                                        endColumn: 0,
                                        originalCode: 'Full file rewrite'
                                    },
                                    modifiedCode: 'Complete file modification'
                                }]
                        };
                    }
                    else {
                        this.streamUpdate('❌ All full file modifications failed. This could be due to syntax errors, Claude AI limitations, or file permission issues.');
                        return { success: false, error: 'Full file modifications failed' };
                    }
                }
                else {
                    this.streamUpdate('🎯 Using TARGETED_NODES modification approach. This provides surgical precision by modifying only specific JSX elements while leaving the rest of the code untouched...');
                    const modifiedRanges = [];
                    for (const filePath of relevantFiles) {
                        this.streamUpdate(`🔍 Processing ${filePath} with AST-based targeted modifications...`);
                        const astNodes = this.parseFileWithAST(filePath);
                        if (astNodes.length === 0) {
                            this.streamUpdate(`⚠️ No AST nodes found in ${filePath}. This file might be empty, have syntax errors, or contain no JSX elements.`);
                            continue;
                        }
                        const targetNodes = yield this.identifyTargetNodes(prompt, filePath, astNodes);
                        if (targetNodes.length === 0) {
                            this.streamUpdate(`ℹ️ No target nodes identified in ${filePath} for your request. This file doesn't contain elements that match your modification criteria.`);
                            continue;
                        }
                        const modifications = yield this.modifyCodeSnippets(prompt, targetNodes);
                        if (modifications.size === 0) {
                            this.streamUpdate(`⚠️ No code modifications generated for ${filePath}. Claude AI might not have understood how to apply your request to the selected elements.`);
                            continue;
                        }
                        const success = yield this.applyModifications(filePath, targetNodes, modifications);
                        if (success) {
                            this.streamUpdate(`✅ Successfully applied ${modifications.size} modifications to ${filePath}`);
                            for (const node of targetNodes) {
                                if (modifications.has(node.id)) {
                                    modifiedRanges.push({
                                        file: filePath,
                                        range: {
                                            startLine: node.startLine,
                                            endLine: node.endLine,
                                            startColumn: node.startColumn,
                                            endColumn: node.endColumn,
                                            originalCode: node.codeSnippet
                                        },
                                        modifiedCode: modifications.get(node.id)
                                    });
                                }
                            }
                        }
                        else {
                            this.streamUpdate(`❌ Failed to apply modifications to ${filePath}. Check file permissions and ensure the file is not locked.`);
                        }
                    }
                    if (modifiedRanges.length > 0) {
                        this.streamUpdate(`🎉 Targeted modification workflow complete! Successfully applied ${modifiedRanges.length} precise code changes across ${relevantFiles.length} files. All modifications are now live in your application!`);
                        return {
                            success: true,
                            selectedFiles: relevantFiles,
                            approach: 'TARGETED_NODES',
                            reasoning: fileAnalysis.reasoning,
                            modifiedRanges
                        };
                    }
                    else {
                        this.streamUpdate('❌ No AST modifications were successfully applied. This could mean the selected files don\'t contain the elements you want to modify, or there were issues with the modification process.');
                        return { success: false, error: 'No AST modifications were successfully applied' };
                    }
                }
            }
            catch (error) {
                this.streamUpdate(`💥 Unexpected error in modification workflow: ${error instanceof Error ? error.message : 'Unknown error'}. This might be due to file system issues, network problems, or code parsing errors.`);
                console.error('Error in modification workflow:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }
}
exports.IntelligentFileModifier = IntelligentFileModifier;
//# sourceMappingURL=filemodifier.js.map