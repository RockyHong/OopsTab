import React from "react";
import { createRoot } from "react-dom/client";
import Options from "../../options/Options";
import "../../styles/tailwind.css";

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<Options />);
