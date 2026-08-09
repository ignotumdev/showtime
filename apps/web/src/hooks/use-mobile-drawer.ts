import * as React from "react";

const mobileDrawerQuery = "(max-width: 639px)";

export function useIsMobileDrawer() {
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(mobileDrawerQuery).matches,
  );

  React.useEffect(() => {
    const query = window.matchMedia(mobileDrawerQuery);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}
