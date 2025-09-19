// next.config.ts（デモ用：型/ESLintエラーを無視してビルド継続）
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // 日本語：本番配布を安定化
  images: {             // 日本語：外部画像を使うなら domains を後で追加
    domains: [],
    remotePatterns: [],
  },

  // ★ TypeScript の型エラーがあってもビルドを止めない
  typescript: { ignoreBuildErrors: true },

  // ★ ESLint エラーがあってもビルドを止めない
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
