import "./globals.css";

export const metadata = {
  title: "TAMA Mod Sharing",
  description: "Platform berbagi file dan mod"
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}