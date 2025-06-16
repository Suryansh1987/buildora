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
class IntelligentFileModifier {
    constructor(anthropic, reactBasePath) {
        this.anthropic = anthropic;
        this.reactBasePath = reactBasePath;
        this.projectFiles = new Map();
    }
    buildProjectTree() {
        return __awaiter(this, void 0, void 0, function* () {
            const srcPath = (0, path_1.join)(this.reactBasePath, 'src');
            try {
                yield fs_1.promises.access(srcPath);
            }
            catch (error) {
                return;
            }
            const scanDir = (dir_1, ...args_1) => __awaiter(this, [dir_1, ...args_1], void 0, function* (dir, relativePath = '') {
                try {
                    const entries = yield fs_1.promises.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = (0, path_1.join)(dir, entry.name);
                        const relPath = relativePath ? (0, path_1.join)(relativePath, entry.name) : entry.name;
                        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                            yield scanDir(fullPath, relPath);
                        }
                        else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
                            yield this.analyzeFile(fullPath, relPath);
                        }
                    }
                }
                catch (error) {
                    console.error(`Error scanning directory ${dir}:`, error);
                }
            });
            yield scanDir(srcPath);
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
            const projectSummary = this.buildProjectSummary();
            const claudePrompt = `
You are analyzing a React project to determine which files need modification AND the scope of changes.

${conversationContext ? `**Conversation Context:**
${conversationContext}

` : ''}**Current User Request:** "${prompt}"

${projectSummary}

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
- If user is building on previous changes (e.g., "also make the header darker" after dark mode), maintain consistency
- If previous attempts failed on certain files, consider alternative files
- Learn from successful modification patterns in the conversation

**Examples:**
- "make signin button red" → TARGETED_NODES
- "add dark mode theme" → FULL_FILE
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
                        return {
                            files: result.files,
                            scope: result.scope,
                            reasoning: result.reasoning
                        };
                    }
                }
                return { files: [], scope: 'TARGETED_NODES' };
            }
            catch (error) {
                console.error('Error in file identification:', error);
                return { files: [], scope: 'TARGETED_NODES' };
            }
        });
    }
    parseFileWithAST(filePath) {
        const file = this.projectFiles.get(filePath);
        if (!file) {
            return [];
        }
        try {
            const ast = (0, parser_1.parse)(file.content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
            });
            const nodes = [];
            let nodeId = 1;
            const lines = file.content.split('\n');
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
            return nodes;
        }
        catch (error) {
            console.error(`Error parsing ${filePath}:`, error);
            return [];
        }
    }
    identifyTargetNodes(prompt, filePath, nodes) {
        return __awaiter(this, void 0, void 0, function* () {
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
                        return targetNodes;
                    }
                }
                return [];
            }
            catch (error) {
                console.error('Error identifying target nodes:', error);
                return [];
            }
        });
    }
    modifyCodeSnippets(prompt, targetNodes) {
        return __awaiter(this, void 0, void 0, function* () {
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
                            return modMap;
                        }
                        catch (parseError) {
                            console.error('JSON parsing failed:', parseError);
                        }
                    }
                }
                return new Map();
            }
            catch (error) {
                console.error('Error modifying code snippets:', error);
                return new Map();
            }
        });
    }
    applyModifications(filePath, targetNodes, modifications) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.projectFiles.get(filePath);
            if (!file) {
                return false;
            }
            let modifiedContent = file.content;
            const lines = modifiedContent.split('\n');
            const sortedNodes = targetNodes
                .filter(node => modifications.has(node.id))
                .sort((a, b) => b.startLine - a.startLine);
            for (const node of sortedNodes) {
                const modifiedCode = modifications.get(node.id);
                if (modifiedCode) {
                    const startIndex = node.startLine - 1;
                    const endIndex = node.endLine - 1;
                    const newLines = modifiedCode.split('\n');
                    lines.splice(startIndex, endIndex - startIndex + 1, ...newLines);
                }
            }
            modifiedContent = lines.join('\n');
            try {
                yield fs_1.promises.writeFile(file.path, modifiedContent, 'utf8');
                return true;
            }
            catch (error) {
                console.error(`Failed to save ${filePath}:`, error);
                return false;
            }
        });
    }
    processModification(prompt, conversationContext) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.buildProjectTree();
                if (this.projectFiles.size === 0) {
                    return { success: false, error: 'No React files found in project' };
                }
                let fileAnalysis = yield this.identifyRelevantFiles(prompt, conversationContext);
                if (fileAnalysis.files.length === 0) {
                    const fallbackFiles = yield this.fallbackFileSearch(prompt);
                    if (fallbackFiles.length > 0) {
                        const scope = yield this.determineScopeForFallbackFiles(prompt, fallbackFiles);
                        fileAnalysis = { files: fallbackFiles, scope };
                    }
                    else {
                        return { success: false, error: 'No relevant files found even after fallback search' };
                    }
                }
                if (fileAnalysis.files.length === 0) {
                    return { success: false, error: 'No relevant files found even after fallback search' };
                }
                const { files: relevantFiles, scope } = fileAnalysis;
                if (scope === 'FULL_FILE') {
                    let successCount = 0;
                    for (const filePath of relevantFiles) {
                        const success = yield this.handleFullFileModification(prompt, filePath);
                        if (success)
                            successCount++;
                    }
                    if (successCount > 0) {
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
                        return { success: false, error: 'Full file modifications failed' };
                    }
                }
                else {
                    const modifiedRanges = [];
                    for (const filePath of relevantFiles) {
                        const astNodes = this.parseFileWithAST(filePath);
                        if (astNodes.length === 0) {
                            continue;
                        }
                        const targetNodes = yield this.identifyTargetNodes(prompt, filePath, astNodes);
                        if (targetNodes.length === 0) {
                            continue;
                        }
                        const modifications = yield this.modifyCodeSnippets(prompt, targetNodes);
                        if (modifications.size === 0) {
                            continue;
                        }
                        const success = yield this.applyModifications(filePath, targetNodes, modifications);
                        if (success) {
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
                    }
                    if (modifiedRanges.length > 0) {
                        return {
                            success: true,
                            selectedFiles: relevantFiles,
                            approach: 'TARGETED_NODES',
                            reasoning: fileAnalysis.reasoning,
                            modifiedRanges
                        };
                    }
                    else {
                        return { success: false, error: 'No AST modifications were successfully applied' };
                    }
                }
            }
            catch (error) {
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