import type { Metadata } from "next";
import "./base.css";

export const metadata: Metadata = {
  title: "Сортировка сотрудников в ЗУП — Бухэксперт",
  description:
    "Интерактивный прототип ИИ-помощника внутри статьи Бухэксперта. Демонстрационные ответы и авторизация.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
