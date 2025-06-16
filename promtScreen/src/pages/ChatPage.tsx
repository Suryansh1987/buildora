import React, { useContext, useEffect, useState } from "react";
import { MyContext } from "../context/FrontendStructureContext";
import axios from "axios";
import { Send, Code, Loader2, MessageSquare, Loader } from "lucide-react";

const ChatPage = () => {
  //@ts-ignore
  const { value, setValue } = useContext(MyContext);
  const [loadingCode, setLoadingCode] = useState(true);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previewLink, setPreviewLink] = useState(
    "https://zewahrnmtqehbaduaewy.supabase.co/storage/v1/object/public/static/sites/build_1750011746798/index.html"
  );

  // const showPreview = async () => {
  //   const zipurl = await axios.get("/zipFolder");
  //   const previewFolderzip = await axios.post("/buildrun", {
  //     zipUrl: zipurl,
  //   });
  // };

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);

    try {
      console.log(prompt, "this is the user prompt");

      const message =
        `You are analyzing a Vite React project structure that uses Tailwind CSS for styling. Based on the user's requirement and the provided project structure, identify which files need to be modified to implement the requested changes.
RESPONSE FORMAT:
Return a JSON object with this exact structure:
{
  "files_to_modify": ["array of existing file paths that need changes"],
  "files_to_create": ["array of new file paths that need to be created"],
  "reasoning": "brief explanation of why these files were selected",
  "dependencies": ["array of npm packages that might need to be installed"],
  "notes": "additional implementation notes or considerations"
}

Consider the file structure carefully and be specific about file paths. If a change affects styling, consider both the component file and any related configuration files. If it's a new feature, consider all the files needed for complete implementation including routing, state management, and API integration if applicable.

PROJECT STRUCTURE: ${JSON.stringify(value, null, 2)}` +
        `USER REQUIREMENT: ${JSON.stringify(
          prompt
        )}, while giving the answer try to use the same name of files used in the PROJECT STRUCTURE, don't assume name and if we need to create files then also analyze the structure given and then make the new files according to it.`;

      const res = await axios.post("http://localhost:3000/generateChanges", {
        prompt: message,
      });

      const data = res.data.content[0].text;

    const filesToChange = await axios.post(
      "http://localhost:3000/extractFilesToChange",
      {
        pwd: "/Users/manmindersingh/Desktop/code /ai-webisite-builder/react-base-temp",
        analysisResult: data,
      }
    );
    console.log(filesToChange.data.files);

    const updatedFile = await axios.post("http://localhost:3000/modify", {
      files: filesToChange.data.files,
      prompt: prompt,
    });
    console.log(updatedFile);
    const parsedData = JSON.parse(updatedFile.data.content[0].text);
    const result = parsedData.map((item) => ({
      path: item.path,
      content: item.content,
    }));

    console.log("parsed data", result);

    await axios.post("http://localhost:3000/write-files", {
      baseDir:
        "/Users/manmindersingh/Desktop/code /ai-webisite-builder/react-base-temp",
      files: result,
    });
  };

  return (
    <div className="w-full bg-gradient-to-br from-black via-neutral-950 to-black h-screen flex">
      {/* Chat Section */}
      <div className="w-1/2 flex flex-col border-r border-slate-700/50">
        {/* Header */}
        <div className="bg-slate-black/50 backdrop-blur-sm border-b border-slate-700/50 p-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold text-white">Buildora</h1>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-slate-800/30 rounded-full mb-4"></div>
              <h3 className="text-lg font-medium animate-spin duration-1000  text-white mb-2">
                <Loader2 />
              </h3>
              <p className="text-slate-400 max-w-sm">
                We are generating code files please wait
              </p>
            </div>
          ) : (
            <></>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-black/30 backdrop-blur-sm border-t border-slate-700/50">
          <div className="relative">
            <textarea
              className="w-full bg-black/50 border border-slate-600/50 rounded-xl text-white p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none transition-all duration-200 placeholder-slate-400"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe the changes you want to make..."
              rows={3}
              disabled={isLoading}
            />
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading}
              className="absolute bottom-3 right-3 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span>{prompt.length}/1000</span>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="w-1/2 flex flex-col bg-slate-900/50">
        {/* Preview Header */}
        <div className="bg-black/50 backdrop-blur-sm border-b border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Live Preview</h2>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 p-4">
          <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden">
            {/* Placeholder for iframe */}
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <Code className="w-8 h-8 text-slate-400" />
                </div>
              </div>
            </div>
            <iframe src="https://zewahrnmtqehbaduaewy.supabase.co/storage/v1/object/public/static/sites/build_1750049856822/index.html" />
            {/* Replace the placeholder div above with your iframe when ready */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
