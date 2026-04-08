import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/jb-finance/",
  plugins: [tailwindcss(), react()],
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
});
