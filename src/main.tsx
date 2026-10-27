import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { sanitizeAnalyticsEvent } from "./analytics";
import App from "./App";
import "./index.css";
import "./enhancements.css";
import "./exercise-catalog.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "./design-system.css";
import "./theme.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Analytics beforeSend={sanitizeAnalyticsEvent} />
  </React.StrictMode>,
);
