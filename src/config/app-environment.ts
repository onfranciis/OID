export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppEnvironment {
  app: {
    name: string;
    env: NodeEnvironment;
    host: string;
    port: number;
    baseUrl: string;
  };
  database: {
    url: string;
    logging: boolean;
  };
  betterAuth: {
    basePath: string;
    cookieName: string;
  };
}
