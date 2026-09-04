import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

if (env.nodeEnv !== "production") {
  app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port} [${env.nodeEnv}]`);
  });
}

export default app;