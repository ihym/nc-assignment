import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:8000/api/py/openapi.json',
  output: {
    format: 'prettier',
    path: './app/api',
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
    {
      name: '@hey-api/client-fetch',
    },
    {
      name: '@tanstack/react-query',
    },
  ],
});
