import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./lib/AuthContext.tsx";
import { MockProvider } from "./lib/MockContext.tsx";
import { ThemeProvider } from "./lib/ThemeContext.tsx";
import { PrivacyProvider } from "./lib/PrivacyContext.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <PrivacyProvider>
          <AuthProvider>
            <MockProvider>
              <App />
            </MockProvider>
          </AuthProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>,
);
