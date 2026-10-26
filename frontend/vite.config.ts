import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "")
    const configuredBase = env.VITE_BASE_PATH || "/"
    const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`

    return {
        base,
        plugins: [ react() ],
        server: {
            host: "0.0.0.0",
            port: 5173,
            allowedHosts: true,
        },
    }
})
