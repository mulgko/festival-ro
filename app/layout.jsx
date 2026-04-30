import "./globals.css";

export const metadata = {
  title: "축제로",
  description: "축제로 시작하는 1박2일 여행 코스를 자동 생성하는 모바일 퍼스트 프로토타입",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
