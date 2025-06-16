import Anthropic from "@anthropic-ai/sdk";
import { BackendSystemPrompt, systemPrompt } from "./defaults/promt";
import { Stream } from "@anthropic-ai/sdk/core/streaming";
import { IntelligentFileModifier } from './services/filemodifier';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import "dotenv/config";
import * as fs from "fs";
import express from "express";
import path, { dirname } from "path";
import { DrizzleMessageHistoryDB, IntelligentFileModifierWithDrizzle } from './db/Messagesummary';
const anthropic = new Anthropic();
const app = express();
import AdmZip from "adm-zip";
import cors from "cors";
import { FileContentParser } from "./defaults/classes";
import { createClient } from "@supabase/supabase-js";
app.use(cors());
app.use(express.json());
const pro =
  "You are an expert web developer creating modern websites using React, TypeScript, and Tailwind CSS. Generate clean, focused website code based on user prompts.\n" +
  "\n" +
  "## Your Role:\n" +
  "Create functional websites with essential sections and professional design.You can use your create approch to make the website look as good as possible you can use cool colours that best suits the website requested by the user , use gradients , differnt effects with tailwind only , dont go for any expernal liberary like framer motion.\n" +
  "\n" +
  "- User already has a Vite React project with TypeScript setup\n" +
  "- All shadcn/ui components are available in src/components/ui/\n" +
  "- Focus on creating files that go inside the src/ folder\n" +
  "- Use shadcn/ui components as much as possible\n" +
  "- Create new custom components when needed\n" +
  "-  Always keep the code moduler and divide it into different files and components\n" +
  "\n" +
  "## Required Files to Provide:\n" +
  "\n" +
  "### MANDATORY Files (provide ALL in every response):\n" +
  "- **src/pages/[PageName].tsx** - Main page component\n" +
  "- **src/App.tsx** - Updated with new routes ( add the / routute with the opening page of your site and also update the route for the pages need to be updated)\n" +
  "- **src/types/index.ts** - TypeScript interfaces for data structures\n" +
  "\n" +
  "### CONDITIONAL Files (create when needed):\n" +
  "- **src/components/[ComponentName].tsx** - Custom reusable components\n" +
  "- **src/hooks/[hookName].ts** - Custom hooks for API calls or logic\n" +
  "- **src/utils/[utilName].ts** - Utility functions if needed\n" +
  "- **src/lib/api.ts** - API configuration and base functions\n" +
  "\n" +
  "### File Creation Rules:\n" +
  "- Always create src/pages/ for main page components\n" +
  "- Create src/components/ for reusable custom components (beyond shadcn/ui)\n" +
  "- Create src/hooks/ for custom React hooks\n" +
  "- Create src/types/ for TypeScript definitions\n" +
  "- Create src/lib/ for API setup and utilities\n" +
  "- Update src/App.tsx only when adding new routes\n" +
  "\n" +
  "## Essential Website Structure:\n" +
  "\n" +
  "### 1. **Hero Section**:\n" +
  "- Clear headline and subheadline\n" +
  "- Primary CTA button\n" +
  "- Simple background (gradient or solid color)\n" +
  "\n" +
  "### 2. **Navigation**:\n" +
  "- Header with logo/brand name\n" +
  "- 3-5 navigation links\n" +
  "- Mobile hamburger menu\n" +
  "\n" +
  "### 3. **Core Content** (Choose 2-3 based on website type):\n" +
  "**Business/Service:** About, Services, Contact\n" +
  "**E-commerce:** Featured Products, Categories, Reviews\n" +
  "**Portfolio:** About, Projects, Skills\n" +
  "**SaaS:** Features, Pricing, How It Works\n" +
  "\n" +
  "### 4. **Footer** (REQUIRED):\n" +
  "- Basic company info\n" +
  "- Quick links\n" +
  "- Contact details\n" +
  "\n" +
  "## Content Guidelines:\n" +
  "- Generate realistic but concise content (no Lorem Ipsum)\n" +
  "- 2-3 testimonials maximum\n" +
  "- 3-4 features/services per section\n" +
  "- Keep descriptions brief but informative\n" +
  "- Include 1-2 CTAs per page\n" +
  "\n" +
  "## Design Requirements:\n" +
  "- Clean, modern design with Tailwind CSS\n" +
  "- Use shadcn/ui components when appropriate\n" +
  "- Mobile-responsive layouts\n" +
  "- Simple hover effects and transitions\n" +
  "- Consistent color scheme\n" +
  "\n" +
  "## Component Usage:\n" +
  '- Use existing shadcn/ui components: `import { Button } from "@/components/ui/button"`\n' +
  '- Use Lucide React icons: `import { ArrowRight, Star } from "lucide-react"`\n' +
  "- TypeScript types within files, or in separate src/types/index.ts\n" +
  "- Import custom components: `import { CustomComponent } from '@/components/CustomComponent'`\n" +
  "\n" +
  "## Data Fetching & State Management (CRITICAL):\n" +
  '- Always use axios for API calls: `import axios from "axios"`\n' +
  "- Don't use Promise.all syntax, make individual axios calls for fetching data\n" +
  "- ALWAYS initialize state arrays as empty arrays: `const [items, setItems] = useState<Type[]>([])`\n" +
  "- NEVER initialize arrays as undefined, null, or non-array values\n" +
  "- Always check if data exists before using array methods:\n" +
  "  ```typescript\n" +
  "  // Good:\n" +
  "  const [products, setProducts] = useState<Product[]>([]);\n" +
  "  {products.length > 0 && products.slice(0, 3).map(...)}\n" +
  "  \n" +
  "  // Bad:\n" +
  "  const [products, setProducts] = useState();\n" +
  "  {products.slice(0, 3).map(...)} // Error: slice is not a function\n" +
  "  ```\n" +
  "- Use proper error handling with try-catch blocks\n" +
  "- Always handle loading states to prevent undefined errors\n" +
  "- When setting state from API responses, ensure data structure matches expected format\n" +
  "\n" +
  "## API Response Structure (Important):\n" +
  "Backend APIs will return data in this format, handle accordingly:\n" +
  "```typescript\n" +
  "// For lists (GET /api/products)\n" +
  "{\n" +
  "  success: true,\n" +
  "  data: [...], // Array of items\n" +
  "  total: number\n" +
  "}\n" +
  "\n" +
  "// For single items (GET /api/products/:id)\n" +
  "{\n" +
  "  success: true,\n" +
  "  data: {...} // Single item object\n" +
  "}\n" +
  "\n" +
  "// Handle responses like this:\n" +
  "const response = await axios.get('/api/products');\n" +
  "if (response.data.success) {\n" +
  "  setProducts(response.data.data); // Access the 'data' property\n" +
  "}\n" +
  "```\n" +
  "\n" +
  "## Error Prevention Rules:\n" +
  "1. **Array State Initialization**: Always initialize arrays as `useState<Type[]>([])`\n" +
  "2. **Conditional Rendering**: Use `array.length > 0 &&` before array methods\n" +
  "3. **Type Safety**: Define proper TypeScript interfaces for data\n" +
  "4. **Loading States**: Show loading indicator while fetching data\n" +
  "5. **Error Boundaries**: Handle API errors gracefully\n" +
  "6. **Data Validation**: Check data structure before setState\n" +
  "\n" +
  "## Response Format (MANDATORY - JSON FORMAT):\n" +
  "ALWAYS return your response in the following JSON format:\n" +
  "\n" +
  "```json\n" +
  "{\n" +
  '  "codeFiles": {\n' +
  '    "src/types/index.ts": "// TypeScript interfaces and types code here",\n' +
  '    "src/pages/PageName.tsx": "// Main page component code here",\n' +
  '    "src/components/ComponentName.tsx": "// Custom component code here (if needed)",\n' +
  '    "src/hooks/useDataFetching.ts": "// Custom hooks code here (if needed)",\n' +
  '    "src/lib/api.ts": "// API configuration code here (if needed)",\n' +
  '    "src/App.tsx": "// Updated App.tsx with routes (only if adding new routes and if you are giving only App.tsx that also also use this and give path as its path)"\n' +
  "  },\n" +
  '  "structureTree": {\n' +
  "// here you will give me the structure  of the files that you have created with file name along with all the files that you think can be necessary in the future to understand the code base and make changes in it  , file path , its imports , its exports and the little description about the file what is does keed the name as exact that you are using ";
("example : { file : App.tsx , path: '/src/app.tsx' , imports:['chatpage.tsx'] , exports:[app] , decription:'this is the main file where  are the routes are defined ' }");
"  }\n" +
  "}\n" +
  "```\n" +
  "\n" +
  "## JSON Response Rules:\n" +
  "1. **codeFiles**: Object containing file paths as keys and complete code content as string values\n" +
  "2. **structureTree**: Nested object representing the complete project structure\n" +
  "3. **File Status Indicators**:\n" +
  '   - "new": Files created in this response\n' +
  '   - "updated": Existing files that were modified\n' +
  '   - "existing": Files that already exist and weren\'t changed\n' +
  "4. **Include ALL files**: Show both new/updated files and existing project structure\n" +
  "5. **Proper JSON syntax**: Ensure valid JSON with proper escaping of quotes and special characters\n" +
  "6. **Complete code**: Include full, working code in the codeFiles object, not truncated versions\n" +
  "\n" +
  "## File Organization Guidelines:\n" +
  "- **src/pages/**: Main page components (HomePage.tsx, AboutPage.tsx, etc.)\n" +
  "- **src/components/**: Custom reusable components (beyond shadcn/ui)\n" +
  "- **src/hooks/**: Custom React hooks for data fetching and logic\n" +
  "- **src/types/**: TypeScript interfaces and type definitions\n" +
  "- **src/lib/**: API setup, utilities, and helper functions\n" +
  "- **src/utils/**: General utility functions\n" +
  "\n" +
  "## Key Changes for Conciseness:\n" +
  '- Generate 50-100 line components unless user requests "detailed" or "comprehensive"\n' +
  "- Focus on 2-3 main sections instead of 6-8\n" +
  "- Shorter content blocks with essential information\n" +
  "- Minimal but effective styling\n" +
  "- Organize code into appropriate files for maintainability\n" +
  "\n" +
  "## Expansion Triggers:\n" +
  "Only create detailed, multi-file websites when user specifically mentions:\n" +
  '- "Detailed" or "comprehensive"\n' +
  '- "Multiple sections" or "full website"\n' +
  '- "Landing page" (these can be more detailed)\n' +
  "- Specific industry requirements that need extensive content\n" +
  "\n" +
  "## Quality Checklist:\n" +
  "✅ Hero section with clear value proposition\n" +
  "✅ Working navigation\n" +
  "✅ 2-3 relevant content sections\n" +
  "✅ Contact information or form\n" +
  "✅ Mobile responsive\n" +
  "✅ Professional appearance\n" +
  "✅ Clean, maintainable code\n" +
  "✅ Proper state initialization (arrays as [])\n" +
  "✅ Error handling and loading states\n" +
  "✅ Axios for data fetching\n" +
  "✅ All required files provided in correct JSON format\n" +
  "✅ Proper file organization\n" +
  "✅ Valid JSON response with files array and structureTree\n" +
  "\n" +
  "Generate focused, professional websites that accomplish the user's goals efficiently. Prioritize clarity and usability over extensive content unless specifically requested. ALWAYS follow the data fetching and error prevention rules to avoid runtime errors. ALWAYS provide files in the specified format and organization.";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const DATABASE_URL = process.env.DATABASE_URL!; // Make sure this is in your .env file
const messageDB = new DrizzleMessageHistoryDB(DATABASE_URL, anthropic);
const fileModifierWithHistory = new IntelligentFileModifierWithDrizzle(
  anthropic,
  path.join(__dirname, "../react-base"),
  DATABASE_URL
);
async function initializeMessageDB() {
  try {
    await messageDB.initializeStats();
    await fileModifierWithHistory.initialize();
    console.log('✅ DrizzleMessageHistoryDB initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize DrizzleMessageHistoryDB:', error);
  }
}

// Call this during server startup
initializeMessageDB();

app.post("/generatebackend", async (req, res) => {
  const { prompt } = req.body;
  try {
    const backendResult = await anthropic.messages.create({
      model: "claude-sonnet-4-0",
      max_tokens: 15000,
      temperature: 1,
      system: BackendSystemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    console.log(backendResult);
    //@ts-ignore
    // const pasredData = JSON.parse(backendResult.content[0].text);
    // console.log(pasredData);

    res.json(backendResult.content[0].text);
    // const backendResponse = JSON.parse(backendResult.content[0].text);
  } catch (error) {
    console.log(error);
  }
});

app.post("/generateFrontend", async (req, res) => {
  const { prompt } = req.body;
  console.log(prompt);
  try {
    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-0",
      max_tokens: 20000,
      temperature: 1,
      system: pro,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    console.log("completed");
    console.log(result);
    res.json(result);
  } catch (error) {}
});

interface FileData {
  path: string;
  content: string;
}

app.post("/test", async (req, res) => {
  const { message } = req.body;
  const backendResult = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 15000,
    temperature: 1,
    system:
      "you are an ai assistent you will answer what ever is asked to you , nothing less , nothing more",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      },
    ],
  });

  console.log(backendResult);
});
//@ts-ignore

app.post("/write-files", (req, res) => {
  const { files }: { files: FileData[] } = req.body;
  const baseDir = path.join(__dirname, "../react-base");
  console.log(baseDir);

  console.log("entered with", baseDir, files);
  if (!baseDir || !Array.isArray(files)) {
    return res.status(400).json({ error: "Invalid baseDir or files" });
  }

  try {
    files.forEach(({ path: filePath, content }) => {
      const fullPath = path.join(baseDir, filePath);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true }); // make directories if not exists
      fs.writeFileSync(fullPath, content, "utf8"); // write or overwrite
    });

    return res.status(200).json({ message: "Files written successfully" });
  } catch (err) {
    console.error("Error writing files:", err);
    return res.status(500).json({ error: "Failed to write files" });
  }
  console.log("created all files ");
});

app.post("/generateChanges", async (req, res) => {
  const { prompt } = req.body;
  
  try {
    console.log(`🚀 8-Step Modification Workflow: "${prompt}"`);
    
   
    const reactBasePath = path.join(__dirname, "../react-base");
    
    const intelligentModifier = new IntelligentFileModifier(anthropic, reactBasePath);
    const result = await intelligentModifier.processModification(prompt);
    
    if (result.success) {
      console.log(`✅ 8-Step workflow completed successfully!`);
      console.log(`📁 Modified files: ${result.selectedFiles?.join(', ')}`);
      console.log(`🎯 Approach: ${result.approach}`);
      console.log(`📊 Code ranges modified: ${result.modifiedRanges?.length || 0}`);
      
      
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
        },
        modifications: result.modifiedRanges?.map(range => ({
          file: range.file,
          linesModified: `${range.range.startLine}-${range.range.endLine}`,
          originalCode: range.range.originalCode.substring(0, 100) + "...", // Preview
          modifiedCode: range.modifiedCode.substring(0, 100) + "..." // Preview
        }))
      });
    } else {
      console.log(`❌ 8-Step workflow failed: ${result.error}`);
      res.status(400).json({
        success: false,
        workflow: "8-step-ast-modification",
        error: result.error || 'Modification workflow failed',
        step: "Failed during workflow execution"
      });
    }
  } catch (error) {
    console.error('Error in 8-step workflow:', error);
    res.status(500).json({
      success: false,
      workflow: "8-step-ast-modification", 
      error: 'Internal server error during workflow',
      step: "System error"
    });
  }
});

app.post("/extractFilesToChange", async (req, res) => {
  try {
    const { pwd, analysisResult } = req.body;
    console.log(analysisResult.files_to_modify, "this is analysed result");
    const parsed = JSON.parse(analysisResult);
    const parser = new FileContentParser(pwd);
    const result = await parser.parseFromAnalysis(parsed);
    res.json(result);
  } catch (error) {}
});

app.post("/modify", async (req, res) => {
  const { files, prompt } = req.body;
  const filesData = JSON.stringify(files);
  const message = `${filesData} these are the files and these are the requested changes from the files ${prompt}  , give me strictly json format with [{ path: string;
  content: string}]; `;
  console.log(message);
  try {
    const result = await anthropic.messages.create({
      model: "claude-3-7-sonnet-latest",
      max_tokens: 15000,
      temperature: 1,
      system:
        "you are a helpful ai assistant that responce with only the things that is requested dont add any other thing no explanation nothing ",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: message,
            },
          ],
        },
      ],
    });
    res.json(result);
  } catch (error) {}
});

app.get("/zipFolder", async (req, res) => {
  try {
    const zip = new AdmZip();
    const baseDir = path.join(__dirname, "../react-base");
    zip.addLocalFolder(baseDir);
    const outDir = path.join(__dirname, "../generated-sites" , "proj123.zip" );
    zip.writeZip(outDir);
    const zipData = fs.readFileSync(outDir);
    const { data, error } = await supabase.storage
      .from("zipprojects")
      .upload("archives/proj123.zip", zipData, {
        contentType: "application/zip",
        upsert: true,
      });
   const publicUrl = await supabase.storage.from("zipprojects").getPublicUrl("proj123.zip")
    

    res.json("done with zipping the file and sending to supabase ");
  } catch (error) {
    console.log(error);
    res.json(error);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
//@ts-ignore
app.post("/messages", async (req, res) => {
  try {
    const { content, messageType, metadata } = req.body;
    
    if (!content || !messageType) {
      return res.status(400).json({
        success: false,
        error: "Content and messageType are required"
      });
    }

    if (!['user', 'assistant'].includes(messageType)) {
      return res.status(400).json({
        success: false,
        error: "messageType must be 'user' or 'assistant'"
      });
    }

    const messageId = await messageDB.addMessage(content, messageType, metadata);
    
    res.json({
      success: true,
      data: {
        messageId,
        message: "Message added successfully"
      }
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});

// 2. Get recent conversation history
app.get("/conversation", async (req, res) => {
  try {
    const conversation = await messageDB.getRecentConversation();
    
    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation'
    });
  }
});

// 3. Get conversation context (for AI prompts)
app.get("/conversation-context", async (req, res) => {
  try {
    const context = await messageDB.getConversationContext();
    
    res.json({
      success: true,
      data: {
        context
      }
    });
  } catch (error) {
    console.error('Error getting conversation context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation context'
    });
  }
});

// 4. Get conversation statistics
app.get("/conversation-stats", async (req, res) => {
  try {
    const stats = await messageDB.getConversationStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting conversation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation stats'
    });
  }
});

// 5. Get all conversation summaries
app.get("/conversation-summaries", async (req, res) => {
  try {
    const summaries = await messageDB.getAllSummaries();
    
    res.json({
      success: true,
      data: summaries
    });
  } catch (error) {
    console.error('Error getting summaries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get summaries'
    });
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

    console.log(`🚀 Processing modification with history: "${prompt}"`);
    
    const result = await fileModifierWithHistory.processModificationWithHistory(prompt);
    
    if (result.success) {
      console.log(`✅ Modification with history completed successfully!`);
      
      res.json({
        success: true,
        data: {
          workflow: "modification-with-history",
          selectedFiles: result.selectedFiles,
          approach: result.approach,
          modifiedRanges: result.modifiedRanges?.length || 0,
          conversationContext: "Applied previous conversation context"
        }
      });
    } else {
      console.log(`❌ Modification with history failed: ${result.error}`);
      res.status(400).json({
        success: false,
        error: result.error || 'Modification with history failed'
      });
    }
  } catch (error) {
    console.error('Error in modification with history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during modification with history'
    });
  }
});

// 7. Get conversation for display (used by file modifier)
app.get("/conversation-display", async (req, res) => {
  try {
    const conversation = await fileModifierWithHistory.getConversationForDisplay();
    
    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Error getting conversation for display:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation for display'
    });
  }
});

// 8. Clear all conversation data (for reset)
app.delete("/conversation", async (req, res) => {
  try {
    await messageDB.clearAllData();
    
    res.json({
      success: true,
      data: {
        message: "All conversation data cleared successfully"
      }
    });
  } catch (error) {
    console.error('Error clearing conversation data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation data'
    });
  }
});

// 9. Add sample conversation
app.post("/sample-conversation", async (req, res) => {
  try {
    // Add some sample messages
    await messageDB.addMessage(
      "I want to add a dark mode toggle to my React app",
      'user'
    );
    
    await messageDB.addMessage(
      "I'll help you add a dark mode toggle. I'll create a theme context and update your components.",
      'assistant',
      {
        fileModifications: ['src/contexts/ThemeContext.tsx', 'src/App.tsx'],
        modificationApproach: 'TARGETED_NODES',
        modificationSuccess: true
      }
    );
    
    await messageDB.addMessage(
      "Can you also add a settings page for theme preferences?",
      'user'
    );
    
    await messageDB.addMessage(
      "I'll create a settings page with theme preferences and save them to localStorage.",
      'assistant',
      {
        fileModifications: ['src/pages/SettingsPage.tsx', 'src/hooks/useTheme.ts'],
        modificationApproach: 'FULL_FILE',
        modificationSuccess: true
      }
    );

    res.json({
      success: true,
      data: {
        message: "Sample conversation added successfully"
      }
    });
  } catch (error) {
    console.error('Error adding sample conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add sample conversation'
    });
  }
});


// async function main() {
//   const responseData = JSON.stringify(res, null, 2);
//   fs.writeFileSync("claude-response.json", responseData);
//   console.log("Response has been saved to claude-response.json");
// }
// main();


