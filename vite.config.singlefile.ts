import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * 单文件离线构建配置：
 * 将全部 JS、CSS、图标与内置 ICU 药库内联至单一 index.html，
 * 专供 iOS Scriptable 包装脚本彻底离线运行。
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    sourcemap: false,
  },
});
