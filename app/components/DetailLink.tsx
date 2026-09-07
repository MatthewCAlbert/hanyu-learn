import { Link, useLocation, type LinkProps } from "react-router";
import { browseOriginFromLocation, readBrowseOrigin } from "~/lib/navigation";

/** Browse origin to attach to detail links so breadcrumbs can return to the list. */
export function useBrowseLinkState() {
  const location = useLocation();
  return browseOriginFromLocation(location) ?? readBrowseOrigin(location.state);
}

/** Like `Link`, but forwards the originating `/hsk/…` view through `location.state`. */
export function DetailLink({ state, ...props }: LinkProps) {
  const origin = useBrowseLinkState();
  return <Link {...props} state={state ?? origin} />;
}
