import { z } from 'zod';

const MONGODB_URI_REQUIRED = 'obrigatória (ex.: mongodb://localhost:27017/clinica)';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string({ error: MONGODB_URI_REQUIRED }).min(1, MONGODB_URI_REQUIRED),
  // Banco usado pelos testes que precisam do MongoDB; cada arquivo de teste troca o nome do banco.
  MONGODB_URI_TEST: z.string().min(1).optional(),
  // Pasta com medicos.json e agendamentos.csv (montada em /data no container).
  DATA_DIR: z.string().min(1).default('/data'),
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
