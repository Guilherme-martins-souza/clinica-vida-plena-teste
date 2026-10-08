import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { criarClienteWhatsapp } from '../../src/mensagens/cliente-whatsapp';

const mensagem = { to: '53948954499', tipo: 'criada', text: 'Clínica Vida Plena' } as const;
let servidor: Server | undefined;

// Sobe um servidor local que responde com o status e, se pedido, demora.
async function subir(status: number, demoraMs = 0): Promise<{ url: string; recebidos: string[] }> {
  const recebidos: string[] = [];
  const novo = createServer((req, res) => {
    let corpo = '';
    req.on('data', (parte) => (corpo += parte));
    req.on('end', () => {
      recebidos.push(`${req.method} ${req.url} ${corpo}`);
      setTimeout(() => {
        res.statusCode = status;
        res.end('{}');
      }, demoraMs);
    });
  });
  servidor = novo;
  await new Promise<void>((ok) => novo.listen(0, '127.0.0.1', ok));
  const { port } = novo.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, recebidos };
}

afterEach(async () => {
  servidor?.closeAllConnections();
  await new Promise<void>((ok) => (servidor ? servidor.close(() => ok()) : ok()));
  servidor = undefined;
});

describe('criarClienteWhatsapp', () => {
  it('201: envia POST /messages com o JSON da mensagem', async () => {
    const { url, recebidos } = await subir(201);
    await expect(criarClienteWhatsapp(url)(mensagem)).resolves.toBeUndefined();
    expect(recebidos).toEqual([`POST /messages ${JSON.stringify(mensagem)}`]);
  });

  it('400: lança Error', async () => {
    const { url } = await subir(400);
    await expect(criarClienteWhatsapp(url)(mensagem)).rejects.toThrow('400');
  });

  it('porta fechada: lança Error', async () => {
    const { url } = await subir(201);
    await new Promise<void>((ok) => servidor?.close(() => ok()));
    await expect(criarClienteWhatsapp(url)(mensagem)).rejects.toThrow();
  });

  it('resposta lenta: estoura o tempo de 5 s', async () => {
    const { url } = await subir(201, 6000);
    await expect(criarClienteWhatsapp(url)(mensagem)).rejects.toThrow();
  }, 10_000);
});
