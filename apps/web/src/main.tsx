import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createHashHistory, createRouter } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RegistryProvider as AtomProvider } from "@effect/atom-react";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const router = createRouter({ routeTree, history: createHashHistory() });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AtomProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-[#0a0a0a] dark">
          <RouterProvider router={router} />
        </div>
      </TooltipProvider>
    </AtomProvider>
  </React.StrictMode>,
);
