import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Sistema de color unificado RestoSuite
        paper: "#FAF6EF",     // fondo general (crema)
        card: "#FFFFFF",
        line: "#EAE0D2",
        ink: "#2A2118",       // texto principal
        muted: "#8C7E6C",
        terra: { DEFAULT: "#7C2D12", dark: "#5A1F0C", light: "#F6E7DD" },
        gold: "#E8A13C",
        moss: "#2E7D4F",
        berry: "#C2402A",
        night: "#241A12",     // fondo oscuro unificado (caja/POS)
        nightcard: "#33261B",
        nightline: "#46362A",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(42,33,24,.06), 0 8px 24px rgba(42,33,24,.06)",
      },
    },
  },
  plugins: [],
};
export default config;
