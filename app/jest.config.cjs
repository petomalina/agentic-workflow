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
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json",
        useESM: false,
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: ["**/*.{test,spec}.{ts,tsx}"],
}
