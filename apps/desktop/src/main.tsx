import React from "react";
import ReactDOM from "react-dom/client";
import { TitleBar } from "@/components/TitleBar";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const router = createRouter({ routeTree });

const isMacOS = navigator.userAgent.includes("Macintosh");

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-[#0a0a0a]">
      <TitleBar isMacOS={isMacOS} />
      <div className="min-h-screen px-3 py-10">
        <RouterProvider router={router} />
      </div>
    </div>
  </React.StrictMode>,
);

// Use contextBridge
window.ipcRenderer.on("main-process-message", (_event, message) => {
  console.log(message);
});
