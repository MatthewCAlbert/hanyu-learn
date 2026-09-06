import { redirect } from "react-router";

export function clientLoader() {
  return redirect("/hsk/1/hanzi");
}
clientLoader.hydrate = true as const;

export default function Home() {
  return null;
}
