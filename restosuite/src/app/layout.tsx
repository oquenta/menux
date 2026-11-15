import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RestoSuite — Administración de Restaurantes",
  description: "SaaS multi-restaurante: menú por QR, caja, tickets por categoría, suscripciones con vencimiento.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
