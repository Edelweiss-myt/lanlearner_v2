// This file augments the global NodeJS.ProcessEnv interface to include
// environment variables that are made available via Vite's `define` config
// or are standard in Vite's environment (like NODE_ENV).

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * The API key for Gemini services, injected via Vite's `define` configuration.
       * @see vite.config.ts
       */
      API_KEY: string;

      /**
       * The Notion API integration token.
       * Injected via Vite's `define` configuration.
       */
      NOTION_API_KEY: string;

      /**
       * The ID of the parent Notion page where new pages will be created.
       * Injected via Vite's `define` configuration.
       */
      NOTION_PAGE_ID: string;

      /**
       * The current environment mode (e.g., 'development', 'production', 'test').
       * Vite sets this automatically.
       */
      NODE_ENV: 'development' | 'production' | 'test';

      // You can add any other process.env variables your app uses here,
      // especially those injected through Vite's `define` config.
    }
  }
}

// Note: By augmenting NodeJS.ProcessEnv, we are telling TypeScript about the shape
// of `process.env`. We are not redeclaring the `process` variable itself, which
// caused the original error. TypeScript should then correctly type `process.env.API_KEY`
// and `process.env.NODE_ENV` throughout your project.

export {};
