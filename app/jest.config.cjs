/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    // Mirror the `@/*` path alias from tsconfig.
    "^@/(.*)$": "<rootDir>/src/$1",
    // CSS / CSS-modules -> proxy so className strings resolve to themselves.
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    // Static assets.
    "\\.(jpg|jpeg|png|gif|webp|svg)$": "<rootDir>/__mocks__/fileMock.js",
  },
  transform: {
    // Also transform .js so Genkit's ESM-only deps (see transformIgnorePatterns)
    // get compiled to CommonJS when the agent evals run.
    "^.+\\.(ts|tsx|js|mjs|cjs)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json",
        useESM: false,
      },
    ],
  },
  // By default Jest skips node_modules; allow-list the ESM-only packages Genkit
  // pulls in so they are transformed instead of failing with import-statement errors.
  transformIgnorePatterns: [
    "node_modules/(?!(?:\\.pnpm/)?(genkit|@genkit-ai|uuid|dotprompt|jsonpath-plus|node-fetch|fetch-blob|formdata-polyfill|data-uri-to-buffer|@google-cloud|google-auth-library|gaxios|gtoken|google-genai)/)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: ["**/*.{test,spec}.{ts,tsx}"],
}
