import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import twilio from 'twilio';
import { ReceiveWhatsappMessage } from '../src/application/receive-whatsapp-message.js';
import { readConfig } from '../src/config.js';
import { FileReplyPolicy } from '../src/infrastructure/file-reply-policy.js';
import { HttpCollectionRequests } from '../src/infrastructure/http-collection-requests.js';
import { MemoryConversationStore } from '../src/infrastructure/memory-conversation-store.js';
import { createWhatsappServer } from '../src/infrastructure/twilio-webhook.js';

const authToken = 'test-twilio-auth-token';
const apiToken = 'test-collection-api-token';
const publicWebhookUrl = new URL('https://ecoconecta.example/webhooks/twilio/whatsapp');
const defaultRepliesPath = 'config/replies.es.json';
const householdPhone = '+15550100001';
const businessPhone = '+15550100002';
const demoSettings = {
  TWILIO_AUTH_TOKEN: authToken,
  TWILIO_WEBHOOK_URL: publicWebhookUrl.href,
  WHATSAPP_MODE: 'demo',
};

test('una lista piloto vacía permite iniciar el modo demo', () => {
  assert.equal(readConfig({ ...demoSettings, WHATSAPP_PILOT_NUMBERS: ' ' }).pilotNumbers, undefined);
  assert.deepEqual(
    readConfig({ ...demoSettings, WHATSAPP_PILOT_NUMBERS: `${householdPhone}, ${businessPhone}` }).pilotNumbers,
    new Set([householdPhone, businessPhone]),
  );
  assert.throws(() => readConfig({ ...demoSettings, WHATSAPP_PILOT_NUMBERS: 'sin indicativo' }), /E\.164/);
});

interface ApiCall {
  method: string | undefined;
  path: string | undefined;
  authorization: string | undefined;
  idempotencyKey: string | string[] | undefined;
  payload: Record<string, unknown>;
}

async function listen(context: TestContext, server: Server): Promise<string> {
  await once(server.listen(0, '127.0.0.1'), 'listening');
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

async function makeWebhook(context: TestContext, options: {
  failFirstSubmission?: boolean;
  contactAliases?: ReadonlyMap<string, string>;
  pilotNumbers?: ReadonlySet<string>;
} = {}) {
  const apiCalls: ApiCall[] = [];
  const apiUrl = await listen(context, createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      apiCalls.push({
        method: request.method,
        path: request.url,
        authorization: request.headers.authorization,
        idempotencyKey: request.headers['idempotency-key'],
        payload: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>,
      });

      if (options.failFirstSubmission && apiCalls.length === 1) {
        response.writeHead(503).end();
        return;
      }

      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: `ECO-${apiCalls.length}`, status: 'recibida' }));
    } catch {
      response.writeHead(400).end();
    }
  }));

  const policy = await FileReplyPolicy.open(defaultRepliesPath);
  const useCase = new ReceiveWhatsappMessage(
    new MemoryConversationStore(),
    new HttpCollectionRequests(new URL('/collection-requests', apiUrl), apiToken),
    policy,
    options.pilotNumbers,
  );
  const origin = await listen(context, createWhatsappServer({
    authToken,
    webhookUrl: publicWebhookUrl.href,
    receive: message => useCase.execute(message),
    contactAliases: options.contactAliases,
  }));

  let sequence = 0;
  async function send(sender: string, body: string, options: {
    messageId?: string;
    validSignature?: boolean;
    waId?: string;
  } = {}) {
    const fields = {
      From: `whatsapp:${sender}`,
      To: 'whatsapp:+15550100099',
      Body: body,
      NumMedia: '0',
      MessageSid: options.messageId ?? `SM${String(++sequence).padStart(32, '0')}`,
      ...(options.waId === undefined ? {} : { WaId: options.waId }),
    };
    const signature = options.validSignature === false
      ? 'incorrect-signature'
      : twilio.getExpectedTwilioSignature(authToken, publicWebhookUrl.href, fields);
    const response = await fetch(new URL(publicWebhookUrl.pathname, origin), {
      method: 'POST',
      headers: { 'x-twilio-signature': signature },
      body: new URLSearchParams(fields),
    });
    return { status: response.status, contentType: response.headers.get('content-type'), content: await response.text() };
  }

  return { apiCalls, send };
}

async function prepareDraft(
  send: Awaited<ReturnType<typeof makeWebhook>>['send'],
  sender: string,
  answers: string[],
): Promise<void> {
  for (const answer of answers) {
    const response = await send(sender, answer);
    assert.equal(response.status, 200);
    assert.match(response.contentType ?? '', /xml/i);
    assert.match(response.content, /<Message[\s>]/);
  }
}

test('las solicitudes firmadas llegan a la API con el flujo y los datos correctos', async context => {
  const { apiCalls, send } = await makeWebhook(context);

  await prepareDraft(send, businessPhone, ['1', '2', 'Carrera 1 # 2–3', 'Lunes de 9 a 11', 'Dos bolsas']);
  const organic = await send(businessPhone, 'sí');
  assert.equal(organic.status, 200);
  assert.match(organic.content, /ECO-1/);

  await prepareDraft(send, householdPhone, ['2', '1', 'Torre B, apto 302', 'Martes por la tarde', 'ninguna']);
  const recyclable = await send(householdPhone, 'SI');
  assert.equal(recyclable.status, 200);
  assert.match(recyclable.content, /ECO-2/);

  assert.equal(apiCalls.length, 2);
  for (const call of apiCalls) {
    assert.equal(call.method, 'POST');
    assert.equal(call.path, '/collection-requests');
    assert.equal(call.authorization, `Bearer ${apiToken}`);
    assert.ok(typeof call.payload.requestId === 'string' && call.payload.requestId.length > 0);
    assert.equal(call.idempotencyKey, call.payload.requestId);
  }

  assert.deepEqual(apiCalls.map(({ payload: { requestId, ...fields } }) => fields), [
    {
      contactPhone: businessPhone,
      wasteType: 'organico',
      generatorType: 'unidad_productiva',
      address: 'Carrera 1 # 2–3',
      availability: 'Lunes de 9 a 11',
      notes: 'Dos bolsas',
      coordinator: 'huerteros',
      source: 'whatsapp',
    },
    {
      contactPhone: householdPhone,
      wasteType: 'reciclable',
      generatorType: 'hogar',
      address: 'Torre B, apto 302',
      availability: 'Martes por la tarde',
      notes: '',
      coordinator: 'recicladores',
      source: 'whatsapp',
    },
  ]);

  assert.match((await send(businessPhone, 'ESTADO')).content, /ECO-1/);
  assert.match((await send(householdPhone, 'ESTADO')).content, /ECO-2/);
});

test('la firma inválida no cambia el borrador de una conversación', async context => {
  const { apiCalls, send } = await makeWebhook(context);
  const forged = await send(householdPhone, '1', { validSignature: false });
  assert.equal(forged.status, 403);

  await prepareDraft(send, householdPhone, ['1', '1', 'Torre C, apto 101', 'Mañana', 'ninguna']);
  assert.match((await send(householdPhone, 'SI')).content, /ECO-1/);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0]?.payload.address, 'Torre C, apto 101');
});

test('un BSUID configurado comparte el borrador y envía el teléfono autorizado al backend', async context => {
  const alias = 'CO.testResident';
  const parentAlias = 'CO.ENT.testPortfolio';
  const { contactAliases, pilotNumbers } = readConfig({
    ...demoSettings,
    WHATSAPP_CONTACT_ALIASES: `${alias}=${householdPhone}, ${parentAlias}=${householdPhone}`,
    WHATSAPP_PILOT_NUMBERS: householdPhone,
  });
  const { apiCalls, send } = await makeWebhook(context, { contactAliases, pilotNumbers });

  await prepareDraft(send, alias, ['1', '1', 'Torre B, apto 210', 'Mañana', 'ninguna']);
  const receipt = await send(householdPhone, 'SI');
  assert.equal(receipt.status, 200);
  assert.match(receipt.content, /ECO-1/);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0]?.payload.contactPhone, householdPhone);

  assert.match((await send(parentAlias, 'ESTADO')).content, /ECO-1/);
});

test('un BSUID sin asociación exacta se rechaza aunque WaId tenga un teléfono autorizado', async context => {
  const { apiCalls, send } = await makeWebhook(context, {
    contactAliases: new Map([['CO.testResident', householdPhone]]),
    pilotNumbers: new Set([householdPhone]),
  });

  const unmapped = [
    { alias: 'CO.testresident', waId: householdPhone.slice(1) },
    { alias: 'CO.unregistered', waId: householdPhone },
  ];
  for (const { alias, waId } of unmapped) {
    const response = await send(alias, '1', { waId });
    assert.equal(response.status, 400);
    assert.doesNotMatch(response.content, /<Message[\s>]/);
  }
  assert.equal(apiCalls.length, 0);
});

test('dos webhooks concurrentes con el mismo SID solo registran una solicitud', async context => {
  const { apiCalls, send } = await makeWebhook(context);
  await prepareDraft(send, householdPhone, ['1', '1', 'Torre B, apto 210', 'Mañana', 'ninguna']);
  const messageId = 'SM00000000000000000000000000000099';
  const responses = await Promise.all([
    send(householdPhone, 'SI', { messageId }),
    send(householdPhone, 'SI', { messageId }),
  ]);

  assert.deepEqual(responses.map(({ status }) => status), [200, 200]);
  assert.equal(responses.filter(({ content }) => /<Message[\s>]/.test(content)).length, 1);
  assert.ok(responses.some(({ content }) => content.includes('ECO-1')));
  assert.equal(apiCalls.length, 1);
});

test('un fallo de la API conserva el borrador y la clave de idempotencia', async context => {
  const { apiCalls, send } = await makeWebhook(context, { failFirstSubmission: true });
  await prepareDraft(send, householdPhone, ['1', '1', 'Torre B, apto 210', 'Mañana', 'ninguna']);

  const firstAttempt = await send(householdPhone, 'SI');
  assert.equal(firstAttempt.status, 200);
  assert.match(firstAttempt.content, /<Message[\s>]/);
  assert.doesNotMatch((await send(householdPhone, 'ESTADO')).content, /ECO-\d+/);

  const repeated = await send(householdPhone, 'SI');
  assert.equal(repeated.status, 200);
  assert.match(repeated.content, /ECO-2/);
  assert.equal(apiCalls.length, 2);
  assert.ok(apiCalls[0]?.idempotencyKey);
  assert.deepEqual(apiCalls[1], apiCalls[0]);
});

test('las reglas de salida se recargan y una edición inválida conserva la última versión válida', async context => {
  const dir = await mkdtemp(join(tmpdir(), 'ecoconecta-whatsapp-'));
  const path = join(dir, 'replies.es.json');
  context.after(async () => {
    await rm(path, { force: true });
    await rmdir(dir);
  });
  const config = JSON.parse(await readFile(defaultRepliesPath, 'utf8')) as {
    maxCharacters: number;
    messages: Record<string, string>;
  };
  await writeFile(path, JSON.stringify(config));
  const policy = await FileReplyPolicy.open(path);

  const updatedMenu = 'Hola, elige 1 para orgánicos o 2 para reciclables.';
  assert.notEqual(await policy.render({ kind: 'menu' }), updatedMenu);
  config.messages.menu = updatedMenu;
  await writeFile(path, JSON.stringify(config));
  assert.equal(await policy.render({ kind: 'menu' }), updatedMenu);

  await writeFile(path, '{ "messages":');
  assert.equal(await policy.render({ kind: 'menu' }), updatedMenu);

  config.messages.menu = 'EcoConecta. Escoge 1 o 2 para pedir recolección.';
  await writeFile(path, JSON.stringify(config));
  assert.equal(await policy.render({ kind: 'menu' }), config.messages.menu);
});
