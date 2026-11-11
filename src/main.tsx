
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import { AppearanceProvider } from './components/Appearance';
  import "./lib/pwa";
  import "./index.css";
  import "./styles/reliability.css";

  createRoot(document.getElementById("root")!).render(<AppearanceProvider><App /></AppearanceProvider>);

import "./styles/localization.css";
import "./styles/apple-design.css";
import "./styles/appearance.css";
