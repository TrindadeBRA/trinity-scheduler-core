import 'dotenv/config';
import app from './app';
import { env } from './config/env';
import { initCronJobs } from './services/cron.service';

app.listen(env.PORT, () => {
  console.log(`Trinity Scheduler Core running on port ${env.PORT}`);
  console.log(`Swagger docs: http://localhost:${env.PORT}/api-docs`);
  
  // Inicializa os cron jobs
  initCronJobs();
});
