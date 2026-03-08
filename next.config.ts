import type { NextConfig } from "next";

function buildRemotePatterns() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
    {
      protocol: "http",
      hostname: "localhost",
      port: "8000",
      pathname: "/public/clubs/**",
    },
  ];

  if (!apiUrl) return patterns;

  try {
    const parsed = new URL(apiUrl);
    const alreadyIncluded = patterns.some(
      (pattern) =>
        pattern.protocol === parsed.protocol.replace(":", "") &&
        pattern.hostname === parsed.hostname &&
        (pattern.port ?? "") === (parsed.port || "")
    );

    if (!alreadyIncluded) {
      patterns.push({
        protocol: parsed.protocol.replace(":", "") as "http" | "https",
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        pathname: "/public/clubs/**",
      });
    }
  } catch {
    // Ignore malformed env values and keep the localhost fallback.
  }

  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: buildRemotePatterns(),
  },
};

export default nextConfig;
