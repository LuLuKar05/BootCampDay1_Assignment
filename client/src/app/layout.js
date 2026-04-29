export const metadata = {
  title: "Assignment1",
  description: "Assignment1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
