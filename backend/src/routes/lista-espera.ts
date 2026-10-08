import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../errors';
import { ListaEspera, type DadosListaEspera } from '../models/lista-espera';
import { inicioDaPagina, lerPaginacao, type Pagina } from '../paginacao';

export const listaEsperaRouter = Router();

const novaPessoaSchema = z.object({
  nome: z.string().trim().min(1),
  telefone: z.string().regex(/^\d{10,11}$/),
  medicoId: z.string().min(1).nullish(),
  antecipar: z.boolean().optional(),
});

interface PessoaResposta {
  id: string;
  nome: string;
  telefone: string;
  medicoId: string | null;
  antecipar: boolean;
  criadoEm: Date;
}

function paraResposta(pessoa: DadosListaEspera & { _id: unknown }): PessoaResposta {
  return {
    id: String(pessoa._id),
    nome: pessoa.nome,
    telefone: pessoa.telefone,
    medicoId: pessoa.medicoId,
    antecipar: pessoa.antecipar,
    criadoEm: pessoa.criadoEm,
  };
}

// Cadastro só pela API (sem tela). A data de cadastro é a do servidor.
listaEsperaRouter.post('/', async (req, res) => {
  const dados = novaPessoaSchema.safeParse(req.body);
  if (!dados.success) {
    throw new HttpError(
      400,
      'DADOS_INVALIDOS',
      'Informe nome e telefone (só dígitos, com DDD); medicoId e antecipar são opcionais.',
    );
  }

  const pessoa = await ListaEspera.create({
    nome: dados.data.nome,
    telefone: dados.data.telefone,
    medicoId: dados.data.medicoId ?? null,
    antecipar: dados.data.antecipar ?? false,
  });
  res.status(201).json(paraResposta(pessoa));
});

// Lista paginada, da mais antiga para a mais nova (a ordem em que a oferta de vaga escolhe).
listaEsperaRouter.get('/', async (req, res) => {
  const paginacao = lerPaginacao(req.query);
  const [pessoas, total] = await Promise.all([
    ListaEspera.find().sort({ criadoEm: 1, _id: 1 }).skip(inicioDaPagina(paginacao)).limit(paginacao.porPagina).lean(),
    ListaEspera.countDocuments(),
  ]);

  const pagina: Pagina<PessoaResposta> = { itens: pessoas.map(paraResposta), total, ...paginacao };
  res.json(pagina);
});
