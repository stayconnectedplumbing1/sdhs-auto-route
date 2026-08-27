import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ServiceM8's Electron desktop client can keep an old HTML shell between
  // deployments. That stale shell may reference JavaScript chunks that no
  // longer exist and ServiceM8 replaces the app with "This page couldn't
  // load". Always serve a fresh dashboard document to add-on clients.
  generateEtags: false,
  async headers() {
    const freshDocumentHeaders = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" }
    ];
    return [
      { source: "/", headers: freshDocumentHeaders },
      { source: "/servicem8", headers: freshDocumentHeaders }
    ];
  }
};

export default nextConfig;
