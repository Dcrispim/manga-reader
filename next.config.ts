import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "dist",
  //output: 'export', // Gera arquivos estáticos
  images: {
    unoptimized: true // Necessário para export estático
  }, eslint: {
    ignoreDuringBuilds: true, // Disables ESLint during builds
  }, typescript: {
    ignoreBuildErrors: true, // Ignora TODOS os erros de TypeScript
  },
};

export default nextConfig;
