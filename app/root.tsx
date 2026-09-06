import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.png", type: "image/png", sizes: "32x32" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Serif+SC:wght@400;500&display=swap",
  },
];

/**
 * Applied before first paint so a dark-mode reader never sees a white flash.
 */
const THEME_INIT = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="han text-6xl text-accent">{is404 ? "无" : "错"}</p>
      <h1 className="mt-6 text-xl font-medium">
        {is404 ? "Not found" : "Something went wrong"}
      </h1>
      <p className="mt-2 text-sm text-ink-2">
        {is404
          ? "That character, word or radical isn't in HSK 1–2."
          : error instanceof Error
            ? error.message
            : "Unknown error."}
      </p>
      <a href="/" className="mt-8 inline-block text-sm text-accent underline underline-offset-4">
        Back to level 1
      </a>
    </main>
  );
}
