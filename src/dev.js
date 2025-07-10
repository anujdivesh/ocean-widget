import React from "react";
import { createRoot } from "react-dom/client";
import Widget from "./widget";
import "bootstrap/dist/css/bootstrap.min.css";
import NiueForecast from "./NiueForecast";

const root = createRoot(document.getElementById("root"));
//root.render(<Widget />);
root.render(<NiueForecast />);