import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSessionCleanup } from "@/lib/room";

// Enforce privacy: clear session on page unload (no re-entry to rooms)
registerSessionCleanup();

createRoot(document.getElementById("root")!).render(<App />);
