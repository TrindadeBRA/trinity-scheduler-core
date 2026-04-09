import 'dotenv/config';
import app from './app';
import { env } from './config/env';
import { initCronJobs } from './services/cron.service';

app.listen(env.PORT, () => {
  console.log(`Kronuz running on port ${env.PORT}`);
  console.log(`Swagger docs: http://localhost:${env.PORT}/api-docs`);
  initCronJobs();
});
