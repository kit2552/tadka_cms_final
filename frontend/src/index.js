import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import dataService from "./services/dataService";

// Expose cache clearing function to browser console for manual refresh
window.clearAppCache = () => {
  dataService.clearCache();
  window.location.reload();
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
