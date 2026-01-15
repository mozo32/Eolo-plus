//DESARROLLO EN LOCAL NO SE SUBE A GIT
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';
import path from "path";

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/css/app.css', 'resources/js/app.tsx'],
      ssr: 'resources/js/ssr.tsx',
      refresh: true,
    }),
    react({
      babel: { plugins: ['babel-plugin-react-compiler'] },
    }),
    tailwindcss(),
    wayfinder({ formVariants: true }),
  ],
resolve: {
    alias: {
        "@": path.resolve(__dirname, "resources/js"),
    },
},
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: {
      host: '192.168.7.10', // la IP de la PC
      port: 5173,
    },
  },

  esbuild: {
    jsx: 'automatic',
  },
});

//DESARROLLO EN EL SERVIDOR
// import { defineConfig } from 'vite';
// import laravel from 'laravel-vite-plugin';
// import react from '@vitejs/plugin-react';
// import tailwindcss from '@tailwindcss/vite';
// import { wayfinder } from '@laravel/vite-plugin-wayfinder';

// export default defineConfig({
//     base: '/eolo-plus/build/',
//     plugins: [
//         laravel({
//             input: ['resources/css/app.css', 'resources/js/app.tsx'],
//             ssr: 'resources/js/ssr.tsx',
//             buildDirectory: 'build',
//             refresh: true,
//         }),
//         react({
//             babel: {
//                 plugins: ['babel-plugin-react-compiler'],
//             },
//         }),
//         tailwindcss(),
//         wayfinder({ formVariants: true }),
//     ],
// });
