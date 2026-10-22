import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../index.css";
import "./tray-panel.css";
import "../i18n";
import { FrontendErrorBoundary } from "@/components/FrontendErrorBoundary";
import { installGlobalErrorHandlers } from "@/lib/frontendLogger";
import { installContextMenuPolicy } from "@/lib/contextMenu";
import { isMac } from "@/lib/platform";
import { TrayPanel } from "./TrayPanel";

installGlobalErrorHandlers();
installContextMenuPolicy();

// 与主窗口 main.tsx 一致：macOS 打 is-mac 标记，index.css 据此保留系统 overlay 滚动条
if (isMac()) {
  document.body.classList.add("is-mac");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FrontendErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TrayPanel />
      </QueryClientProvider>
    </FrontendErrorBoundary>
  </React.StrictMode>,
);
