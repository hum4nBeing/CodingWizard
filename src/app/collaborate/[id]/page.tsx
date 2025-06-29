"use client";

import React, { useState, useEffect, useRef } from "react";
import Editor, { Monaco } from "@monaco-editor/react";
import { usePlaygroundState } from "@/context/playgroundProvider";
import toast from "react-hot-toast";
import { getSocket } from "@/config/socket";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import axios from "axios";
import { editor } from "monaco-editor";
import { Socket } from "socket.io-client";

type Client = {
  username: string;
  socketId: string;
};

const languageMap: Record<string, number> = {
  javascript: 63,
  python: 71,
  cpp: 54,
  java: 62,
  c: 50,
};

const CollaborativePage: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [code, setCode] = useState<string>("//Write your code here");
  const [client, setClient] = useState<Client[]>([]);
  
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { user } = usePlaygroundState();
  const [language, setLanguage] = useState("javascript");

  const params = useParams() as { id: string };
  const { id } = params;
// eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (user && id) {
      socket.connect();
      socket.emit("join", { id, user });

      socket.on("joined", ({ clients, username, socketId }) => {
        if (username !== user?.username) toast.success(`${username} joined!`);
        setClient(clients);
        if (clients.length > 1) {
          socket.emit("syncCode", { socketId, code });
        }
      });

      socket.on("disconnected", ({ socketId, username }) => {
        toast.error(`${username} left!`);
        setClient((prev) => prev.filter((c) => c.socketId !== socketId));
      });

      socket.on("codeChange", (newCode) => {
        setCode(newCode);
        if (editorRef.current) editorRef.current.setValue(newCode);
      });

      socket.on("changeLanguage", (newLang) => {
        setLanguage(newLang);
      });

      return () => {
        socket.disconnect();
        socket.off("joined");
        socket.off("disconnected");
        socket.off("codeChange");
        socket.off("changeLanguage");
        socket.off("syncCode");
      };
    }
  }, [user, id]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && socketRef.current) {
      setCode(value);
      socketRef.current.emit("codeChange", { id, code: value });
    }
  };

  const changeLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    socketRef.current!.emit("changeLanguage", { id, language: newLang });
  };

  const getResult = async (token: string) => {
    const options = {
      method: "GET",
      url: `https://judge0-ce.p.rapidapi.com/submissions/${token}`,
      params: {
    base64_encoded: 'true',
    fields: '*'
  },
       headers: {
    'x-rapidapi-key': process.env.NEXT_PUBLIC_JUDGE0_API_KEY!,
    'x-rapidapi-host': 'judge0-ce.p.rapidapi.com'
  }
    };

    try {
      const response = await axios.request(options);
      const result = response.data;
      if (result.status.id === 1 || result.status.id === 2) {
        setTimeout(() => getResult(token), 2000);
      } else if (result.status.id === 3) {
        const output = atob(result.stdout);
        console.log(output);
        console.log(result);
        setOutput(
          output
        );
        setLoading(false);
      } else {
        let errorMessage = ` ${result.status.description}`;
        if (result.stderr) {
          const errors = atob(result.stderr);
          const formattedError = parseErrorMessage(errors);
          errorMessage = `${formattedError}`;
        } else if (result.compile_output) {
          const compileErrors = atob(result.compile_output);
          const formattedCompileError = parseErrorMessage(compileErrors);
          errorMessage = `${formattedCompileError}`;
        }

        setOutput(errorMessage);
        setLoading(false);
      }
    } catch (error: unknown) {
      setLoading(false);
      if (error instanceof Error) {
        setOutput(error.message);
      } else {
        setOutput("Unknown error occurred");
      }

      console.error(error);
    }
  };

    const parseErrorMessage = (errorMessage: string) => {
    const errorRegex = /(\S+):(\d+)\s*(.*)/;

    const match = errorMessage.match(errorRegex);

    if (match) {
      const file = match[1];
      const lineNumber = match[2];
      const errorDescription = match[3];

      return `Error in file ${file} at line ${lineNumber}: ${errorDescription}`;
    } else {
      return `Error: ${errorMessage}`;
    }
  };

  const runCode = async () => {
    if (!code || !language) {
      toast.error("Please enter code and select a language.");
      return;
    }
     
    const options = {
      method: "POST",
      url: "https://judge0-ce.p.rapidapi.com/submissions",
       params: {base64_encoded: 'true',
    wait: 'false',
    fields: '*'},
      headers: {
        "x-rapidapi-key": process.env.NEXT_PUBLIC_JUDGE0_API_KEY!,
        "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        source_code: btoa(code),
        language_id: languageMap[language],
        stdin: btoa(input),

      }),
    };

    setLoading(true);
    setOutput("");

    try {
       const response = await axios.request(options);
      const token = response.data.token;
      if (token) {
        getResult(token);
      }
      else {
        toast.error("Submission failed");
        setLoading(false);
      }
    } catch {
      toast.error("Error during submission.");
      setLoading(false);
    }
  };

  // const pollResult = async (token: string) => {
  //   try {
  //     const res = await fetch(
  //       `https://judge0-ce.p.rapidapi.com/submissions/${token}?base64_encoded=true`,
  //       {
  //         headers: {
  //           "x-rapidapi-key": process.env.NEXT_PUBLIC_JUDGE0_API_KEY!,
  //           "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
  //         },
  //       }
  //     );
  //     const result = await res.json();
  //     if (result.status.id <= 2) {
  //       setTimeout(() => pollResult(token), 1500);
  //     } else if (result.stdout) {
  //       setOutput(atob(result.stdout));
  //       setLoading(false);
  //     } else if (result.stderr) {
  //       setOutput("Error:\n" + atob(result.stderr));
  //       setLoading(false);
  //     } else {
  //       setOutput("Unknown error.");
  //       setLoading(false);
  //     }
  //   } catch {
  //     setLoading(false);
  //     setOutput("Failed to get result.");
  //   }
  // };

  return (
    <div className="flex h-screen overflow-y-scroll overflow-x-hidden bg-slate-700">
      <Sidebar
        sidebarOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        client={client}
        id={id}
      />
      <div
        className={`flex-grow flex flex-col ${
          sidebarOpen ? "ml-64" : "ml-16"
        } transition-margin duration-300 ease-in-out`}
      >
        <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
          <select
            className="bg-gray-200 text-black font-bold py-2 px-4 rounded"
            value={language}
            onChange={changeLanguage}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
            <option value="c">C</option>
          </select>
        </div>

        <div className="flex-grow h-full w-full">
          <Editor
            value={code}
            options={{
              minimap: { enabled: false },
              automaticLayout: true,
              fontSize: 16,
              padding: { top: 5 },
              wordWrap: "on",
            }}
            theme={"my-dark-theme"}
            className="w-full h-full"
            beforeMount={(monaco: Monaco) => {
              monaco.editor.defineTheme("my-dark-theme", {
                base: "vs-dark",
                inherit: true,
                rules: [],
                colors: { "editor.background": "#1f2937" },
              });
            }}
            onChange={handleEditorChange}
            language={language || "javascript"}
          />
        </div>

        <div className="p-4 bg-gray-800 text-white">
          <div className="mb-2">
            <label>Input</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full p-2 rounded bg-gray-900 text-white"
              rows={4}
            />
          </div>
          <button
            onClick={runCode}
            className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded text-white"
            disabled={loading}
          >
            {loading ? "Running..." : "Run Code"}
          </button>
          <div className="mt-4">
            <label>Output</label>
            <pre className="bg-gray-900 text-green-400 p-2 rounded whitespace-pre-wrap">
              {output}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollaborativePage;
