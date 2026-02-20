import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.{test,spec,prop}.?(c|m)[jt]s?(x)'],
  },
})
