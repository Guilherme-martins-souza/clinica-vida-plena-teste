import { z } from 'zod';

const MONGODB_URI_REQUIRED = 'obrigatória (ex.: mongodb://localhost:27017/clinica)';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string({ error: MONGODB_URI_REQUIRED }).min(1, MONGODB_URI_REQUIRED),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
