import { redirect } from "react-router";

export function loader() {
  return redirect("/hsk/1/hanzi");
}

export default function Home() {
  return null;
}
