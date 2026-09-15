import { resolve } from "path"
import { defineConfig, loadEnv } from "vite"
import minimist from "minimist"
import { viteStaticCopy } from "vite-plugin-static-copy"
import Vue from '@vitejs/plugin-vue'
import zipPack from "vite-plugin-zip-pack";
import fg from 'fast-glob';

// vue
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { TDesignResolver } from 'unplugin-vue-components/resolvers';
import vueJsx from '@vitejs/plugin-vue-jsx'

const args = minimist(process.argv.slice(2))
const isWatch = args.watch || args.w || false
const devDistDir = "./dev"
const distDir = isWatch ? devDistDir : "./dist"
const siyuanEnv = loadEnv(isWatch ? "development" : "production", process.cwd(), "VITE_SIYUAN_")
const siyuanOrigin = siyuanEnv.VITE_SIYUAN_ORIGIN || "http://127.0.0.1:6806"
const siyuanToken = siyuanEnv.VITE_SIYUAN_TOKEN || ""

console.log("isWatch=>", isWatch)
console.log("distDir=>", distDir)

function siyuanAutoReload() {
    let timer: ReturnType<typeof setTimeout> | undefined

    return {
        name: "siyuan-auto-reload",
        apply: "build" as const,
        closeBundle() {
            if (!isWatch) return

            clearTimeout(timer)
            timer = setTimeout(async () => {
                try {
                    const response = await fetch(new URL("/api/ui/reloadUI", siyuanOrigin), {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(siyuanToken ? { "Authorization": `Token ${siyuanToken}` } : {}),
                        },
                        body: "{}",
                    })
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status} ${response.statusText}`)
                    }
                    console.log("[siyuan-auto-reload] reload requested")
                } catch (error) {
                    console.warn("[siyuan-auto-reload] reload failed:", error)
                }
            }, 250)
        },
    }
}

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(import.meta.dirname, "src"),
        }
    },

    plugins: [
        Vue(),
        vueJsx(),
        siyuanAutoReload(),
        AutoImport({
            dts: "src/types/auto-imports.d.ts",
            resolvers: [TDesignResolver({
              library: 'vue-next'
            })],
          }),
          Components({
            dts: "src/types/components.d.ts",
            resolvers: [TDesignResolver({
              library: 'vue-next'
            })],
          }),
        viteStaticCopy({
            targets: [
                {
                    src: "docs/README*.md",
                    dest: "./",
                },
                {
                    src: "assets/icon.png",
                    rename: { stripBase: 1 },
                    dest: "./",
                },
                {
                    src: "assets/preview.png",
                    rename: { stripBase: 1 },
                    dest: "./",
                },
                {
                    src: "./plugin.json",
                    dest: "./",
                },
                {
                    src: "src/i18n/*.json",
                    rename: { stripBase: 2 },
                    dest: "./i18n/",
                },
            ],
        }),
    ],

    // https://github.com/vitejs/vite/issues/1930
    // https://vitejs.dev/guide/env-and-mode.html#env-files
    // https://github.com/vitejs/vite/discussions/3058#discussioncomment-2115319
    // 在这里自定义变量
    define: {
        "process.env.DEV_MODE": `"${isWatch}"`,
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    },

    build: {
        // 输出路径
        outDir: distDir,
        emptyOutDir: !isWatch,

        // 构建后是否生成 source map 文件
        sourcemap: false,

        // 设置为 false 可以禁用最小化混淆
        // 或是用来指定是应用哪种混淆器
        // boolean | 'terser' | 'esbuild'
        // 不压缩，用于调试
        minify: !isWatch,

        lib: {
            // Could also be a dictionary or array of multiple entry points
            entry: resolve(import.meta.dirname, "src/index.ts"),
            // the proper extensions will be added
            fileName: "index",
            formats: ["cjs"],
        },
        rollupOptions: {
            plugins: [
                ...(
                    isWatch ? [
                        {
                            //监听静态资源文件
                            name: 'watch-external',
                            async buildStart() {
                                const files = await fg([
                                    'src/i18n/*.json',
                                    'docs/README*.md',
                                    'assets/icon.png',
                                    'assets/preview.png',
                                    './plugin.json'
                                ]);
                                for (let file of files) {
                                    this.addWatchFile(file);
                                }
                            }
                        }
                    ] : [
                        zipPack({
                            inDir: './dist',
                            outDir: './',
                            outFileName: 'package.zip'
                        })
                    ]
                )
            ],

            // make sure to externalize deps that shouldn't be bundled
            // into your library
            external: ["siyuan", "process"],

            output: {
                entryFileNames: "[name].js",
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === "style.css") {
                        return "index.css"
                    }
                    return assetInfo.name
                },
            },
        },
    }
})
