import { redirect } from "react-router";
import { defaultBrowsePath } from "~/lib/levels";

export function clientLoader() {
  return redirect(defaultBrowsePath());
}
clientLoader.hydrate = true as const;

export default function Home() {
  return null;
}
