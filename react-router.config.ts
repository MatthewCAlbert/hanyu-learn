import type { Config } from "@react-router/dev/config";

export default {
  // Static SPA: one HTML shell, data loaded in the browser from versioned JSON.
  ssr: false,
} satisfies Config;
