import "./globals.css";

export const metadata = {
  title: "Hacıveyiszade - Otomatik Kapı Sistemi",
  description: "Hacıveyiszade akıllı sistemler için otomatik kapı kontrol arayüzü.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>
        {children}
      </body>
    </html>
  );
}

