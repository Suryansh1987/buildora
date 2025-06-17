import { useContext, useState } from "react";
import axios from "axios";

//import { parseApiData } from "../utils/backendcodeParser";
import { parseFrontendCode } from "../utils/newParserWithst";
import { MyContext } from "../context/FrontendStructureContext";
import ChatPage from "./ChatPage";
import { motion, AnimatePresence } from "motion/react";

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  //@ts-ignore
  const { value, setValue } = useContext(MyContext);

  // Use the same API_BASE_URL pattern as ChatPage
  const API_BASE_URL = '/api'; // Use Vite proxy instead of direct localhost:3000

  const handleSubmit = async () => {
    setIsLoading(true);
    setSubmitted(true);

    try {
      // const response = await axios.post(
      //   `${API_BASE_URL}/generatebackend`,
      //   {
      //     prompt,
      //   }
      // );
      // console.log("backend", response);

      // const data = parseApiData(response.data);
      // console.log(data, "parsed");
      // const codeFiles = data.codeFiles;
      // await axios.post(`${API_BASE_URL}/write-files`, {
      //   baseDir:
      //     "/Users/manmindersingh/Desktop/code /ai-webisite-builder/backend-base-templete",
      //   files: codeFiles,
      // });

      // const frontendPrompt = `${prompt}\n\nImportant: The frontend should integrate with the following backend API endpoints:\n${data.apiEndpoints
      //   .map(
      //     (endpoint) =>
      //       `${endpoint.method} ${endpoint.path} - ${endpoint.description}`
      //   )
      //   .join("\n")}
      //    take the base url as http://localhost:3003. `;

      console.log("started ");

      // Updated to use proxy
      const frontendres = await axios.post(
        `${API_BASE_URL}/generateFrontend`,
        {
          prompt,
        }
      );
      console.log(frontendres);

      // const parse = parseInput(frontendres);
      console.log("completed");
      const parsedFrontend = parseFrontendCode(
        `${frontendres.data.content[0].text}`
      );

      setValue(parsedFrontend.structure);
      console.log("parsed frontend", parsedFrontend.codeFiles);
      console.log(parsedFrontend.structure, "structure");

      // console.log(parse);
      //   const frontenddata = await parseGeneratedCodeFlexible(
      //     frontendres.data.content[0].text
      //   );
      console.log("now starting to insert files ");
      
      // Updated to use proxy
      await axios.post(`${API_BASE_URL}/write-files`, {
        files: parsedFrontend.codeFiles,
      });
      
      // Updated to use proxy
      const res = await axios.get(`${API_BASE_URL}/zipFolder`);
      console.log(res.data);
      setIsLoading(false);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!submitted ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="bg-black h-screen min-w-full flex flex-col items-center justify-center relative overflow-hidden"
        >
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Floating Code Blocks */}
            <motion.div
              animate={{
                y: [-20, 20, -20],
                rotate: [0, 5, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute top-20 left-10 opacity-10"
            >
              <div className="text-white text-xs font-mono bg-neutral-800 p-2 rounded">
                {'<div className="app">'}
              </div>
            </motion.div>

            <motion.div
              animate={{
                y: [20, -20, 20],
                rotate: [0, -3, 0],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
              className="absolute top-40 right-20 opacity-10"
            >
              <div className="text-white text-xs font-mono bg-neutral-800 p-2 rounded">
                {"function build() {"}
              </div>
            </motion.div>

            <motion.div
              animate={{
                y: [-15, 15, -15],
                rotate: [0, 2, 0],
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2,
              }}
              className="absolute bottom-32 left-20 opacity-10"
            >
              <div className="text-white text-xs font-mono bg-neutral-800 p-2 rounded">
                {"return <App />"}
              </div>
            </motion.div>

            {/* Floating Geometric Shapes */}
            <motion.div
              animate={{
                x: [-10, 10, -10],
                y: [-5, 5, -5],
                rotate: [0, 360],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute top-1/4 right-1/4 w-4 h-4 border border-neutral-700 opacity-20"
            />

            <motion.div
              animate={{
                x: [10, -10, 10],
                y: [5, -5, 5],
                rotate: [360, 0],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute bottom-1/4 left-1/4 w-6 h-6 border border-neutral-600 rounded-full opacity-15"
            />

            <motion.div
              animate={{
                x: [-5, 5, -5],
                y: [10, -10, 10],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute top-1/3 left-1/3 w-3 h-3 bg-neutral-700 opacity-10 transform rotate-45"
            />

            {/* Animated Grid Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="grid grid-cols-12 grid-rows-12 h-full w-full">
                {Array.from({ length: 144 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.3, 0] }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      delay: i * 0.1,
                      ease: "easeInOut",
                    }}
                    className="border-r border-b border-neutral-800"
                  />
                ))}
              </div>
            </div>

            {/* Floating Particles */}
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  y: [-100, -window.innerHeight - 100],
                  x: [0, Math.random() * 100 - 50],
                }}
                transition={{
                  duration: Math.random() * 10 + 10,
                  repeat: Infinity,
                  ease: "linear",
                  delay: Math.random() * 5,
                }}
                className="absolute w-1 h-1 bg-neutral-600 rounded-full opacity-30"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: "100%",
                }}
              />
            ))}
          </div>

          {/* Main Content */}
          <motion.h1
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 1.2,
              ease: "easeOut",
              delay: 0.3,
            }}
            className="p-0 text-[10rem] bg-gradient-to-b tracking-tighter from-white via-white to-transparent bg-clip-text text-transparent font-bold mb-0 relative z-10"
          >
            <motion.span
              animate={{
                textShadow: [
                  "0 0 0px rgba(255,255,255,0)",
                  "0 0 20px rgba(255,255,255,0.1)",
                  "0 0 0px rgba(255,255,255,0)",
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              BUildora
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 1,
              ease: "easeOut",
              delay: 0.8,
            }}
            className="text-neutral-600 text-xs mt-0 absolute relative z-10"
          >
            {/* <motion.span
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
       
            >
              Wanna give life to you ideas we got you covered, just tell us we
              will help you transform
            </motion.span> */}
          </motion.p>

          <motion.textarea
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{
              duration: 1,
              ease: "easeOut",
              delay: 1.2,
            }}
            whileFocus={{
              scale: 1.02,
              boxShadow: "0 0 0 2px rgba(96, 165, 250, 0.3)",
            }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="mb-4 border-2 focus:outline-0 border-neutral-400 rounded-lg text-neutral-500 p-3 w-[30rem] h-36 relative z-10 bg-black/50 backdrop-blur-sm transition-all duration-300"
          />

          <motion.button
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 1,
              ease: "easeOut",
              delay: 1.5,
            }}
            whileHover={{
              scale: 1.05,
              boxShadow: "0 10px 25px rgba(96, 165, 250, 0.3)",
            }}
            whileTap={{ scale: 0.95 }}
            className="w-fit px-7 rounded-lg py-1 bg-blue-400 relative z-10 transition-all duration-300"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            <motion.span
              animate={
                isLoading
                  ? {
                      opacity: [1, 0.5, 1],
                    }
                  : {}
              }
              transition={
                isLoading
                  ? {
                      duration: 1,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
                  : {}
              }
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  />
                  Processing...
                </span>
              ) : (
                "Submit"
              )}
            </motion.span>
          </motion.button>

          {/* Corner Decorations */}
          <motion.div
            animate={{
              opacity: [0.1, 0.3, 0.1],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-10 left-10 w-20 h-20 border-l-2 border-t-2 border-neutral-700"
          />

          <motion.div
            animate={{
              opacity: [0.1, 0.3, 0.1],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
            className="absolute bottom-10 right-10 w-20 h-20 border-r-2 border-b-2 border-neutral-700"
          />

          <motion.div
            animate={{
              opacity: [0.1, 0.3, 0.1],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
            className="absolute top-10 right-10 w-20 h-20 border-r-2 border-t-2 border-neutral-700"
          />

          <motion.div
            animate={{
              opacity: [0.1, 0.3, 0.1],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 3,
            }}
            className="absolute bottom-10 left-10 w-20 h-20 border-l-2 border-b-2 border-neutral-700"
          />
        </motion.div>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <ChatPage />
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
};

export default Index;