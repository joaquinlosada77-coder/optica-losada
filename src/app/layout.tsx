import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Óptica · Gestión", template: "%s · Óptica" },
  description: "Software de gestión para ópticas en Chile",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
