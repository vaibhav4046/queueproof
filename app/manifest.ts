import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QueueProof",
    short_name: "QueueProof",
    description:
      "Ask across your work sources and get one clear answer with proof, disagreements, and next actions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070605",
    theme_color: "#070605",
    icons: [
      {
        src: "/queueproof-icon-v2-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/queueproof-icon-v2-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/queueproof-icon-v2-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
