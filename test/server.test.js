const assert = require('node:assert/strict');
const { test } = require('node:test');
const { io: createClient } = require('socket.io-client');
const {
  createChatServer,
  createInMemoryMessageStore,
  createMongoMessageStore,
  getLocalNetworkAddresses,
} = require('../server');

function waitForEvent(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function connect(url) {
  const socket = createClient(url, {
    reconnection: false,
    transports: ['websocket'],
  });
  const connected = waitForEvent(socket, 'connect');
  socket.connect();
  return connected.then(() => socket);
}

function join(socket, nombre) {
  return new Promise((resolve) => {
    socket.emit('entrar', nombre, resolve);
  });
}

test('muestra únicamente direcciones IPv4 de red, no direcciones internas', () => {
  assert.deepEqual(getLocalNetworkAddresses({
    Ethernet: [
      { address: '192.168.1.25', family: 'IPv4', internal: false },
      { address: '127.0.0.1', family: 'IPv4', internal: true },
    ],
    Tunnel: [
      { address: '2001:db8::1', family: 'IPv6', internal: false },
      { address: '10.0.0.8', family: 4, internal: false },
    ],
  }), ['192.168.1.25', '10.0.0.8']);
});

async function withChatServer(messageStore, callback) {
  const chat = createChatServer({ messageStore });
  const clientes = [];

  await new Promise((resolve) => chat.server.listen(0, resolve));
  const url = `http://localhost:${chat.server.address().port}`;

  try {
    await callback({ ...chat, clientes, url });
  } finally {
    clientes.forEach((cliente) => cliente.disconnect());
    await new Promise((resolve) => chat.io.close(resolve));
  }
}

test('maneja ingreso, mensajes, escritura, historial y desconexión', async () => {
  const messageStore = createInMemoryMessageStore();

  await withChatServer(messageStore, async ({ clientes, url, usuarios }) => {
    const ana = await connect(url);
    clientes.push(ana);
    const anaHistorial = waitForEvent(ana, 'historial');
    const anaSistema = waitForEvent(ana, 'sistema');
    const anaUsuarios = waitForEvent(ana, 'usuarios');
    assert.deepEqual(await join(ana, 'Ana'), { ok: true });
    assert.deepEqual(await anaHistorial, []);
    assert.equal(await anaSistema, 'Ana se unió al chat');
    assert.deepEqual(await anaUsuarios, ['Ana']);

    const luis = await connect(url);
    clientes.push(luis);
    const usuariosAna = waitForEvent(ana, 'usuarios');
    const sistemaAna = waitForEvent(ana, 'sistema');
    const historialLuis = waitForEvent(luis, 'historial');
    const sistemaLuis = waitForEvent(luis, 'sistema');
    const usuariosLuis = waitForEvent(luis, 'usuarios');
    assert.deepEqual(await join(luis, 'Luis'), { ok: true });
    assert.deepEqual(await historialLuis, []);
    assert.equal(await sistemaAna, 'Luis se unió al chat');
    assert.equal(await sistemaLuis, 'Luis se unió al chat');
    assert.deepEqual(await usuariosAna, ['Ana', 'Luis']);
    assert.deepEqual(await usuariosLuis, ['Ana', 'Luis']);

    assert.deepEqual(await join(luis, 'Ana'), {
      ok: false,
      error: 'Ese nombre ya está conectado. Elige otro.',
    });

    let anaRecibioEscritura = false;
    ana.on('escribiendo', () => {
      anaRecibioEscritura = true;
    });
    const escrituraLuis = waitForEvent(luis, 'escribiendo');
    ana.emit('escribiendo');
    assert.equal(await escrituraLuis, 'Ana');
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(anaRecibioEscritura, false);

    for (let indice = 0; indice < 21; indice += 1) {
      const mensajesAna = waitForEvent(ana, 'mensaje');
      const mensajesLuis = waitForEvent(luis, 'mensaje');
      ana.emit('mensaje', `Mensaje ${indice}`, { autor: 'Suplantador' });
      const [mensajeAna, mensajeLuis] = await Promise.all([mensajesAna, mensajesLuis]);
      assert.deepEqual(mensajeAna, mensajeLuis);
      assert.equal(mensajeAna.autor, 'Ana');
      assert.equal(mensajeAna.texto, `Mensaje ${indice}`);
      assert.equal(Number.isNaN(Date.parse(mensajeAna.hora)), false);
    }

    const carla = await connect(url);
    clientes.push(carla);
    const historialCarla = waitForEvent(carla, 'historial');
    const sistemaCarla = waitForEvent(ana, 'sistema');
    const usuariosCarla = waitForEvent(ana, 'usuarios');
    assert.deepEqual(await join(carla, 'Carla'), { ok: true });
    const mensajesAnteriores = await historialCarla;
    assert.equal(await sistemaCarla, 'Carla se unió al chat');
    assert.deepEqual(await usuariosCarla, ['Ana', 'Luis', 'Carla']);
    assert.equal(mensajesAnteriores.length, 21);
    assert.equal(mensajesAnteriores[0].texto, 'Mensaje 0');
    assert.equal(mensajesAnteriores.at(-1).texto, 'Mensaje 20');
    assert.equal(usuarios.size, 3);

    const desconexionSistema = waitForEvent(ana, 'sistema');
    const desconexionUsuarios = waitForEvent(ana, 'usuarios');
    luis.disconnect();
    assert.equal(await desconexionSistema, 'Luis salió del chat');
    assert.deepEqual(await desconexionUsuarios, ['Ana', 'Carla']);
    assert.equal(usuarios.size, 2);
  });
});

test('recupera mensajes guardados después de iniciar otra instancia del servidor', async () => {
  const messageStore = createInMemoryMessageStore();
  let mensajeGuardado;

  await withChatServer(messageStore, async ({ clientes, url }) => {
    const ana = await connect(url);
    clientes.push(ana);
    const historial = waitForEvent(ana, 'historial');
    assert.deepEqual(await join(ana, 'Ana'), { ok: true });
    assert.deepEqual(await historial, []);

    mensajeGuardado = waitForEvent(ana, 'mensaje');
    ana.emit('mensaje', 'Este mensaje debe sobrevivir al servidor');
    await mensajeGuardado;
  });

  await withChatServer(messageStore, async ({ clientes, url }) => {
    const luis = await connect(url);
    clientes.push(luis);
    const historial = waitForEvent(luis, 'historial');
    assert.deepEqual(await join(luis, 'Luis'), { ok: true });
    assert.deepEqual(await historial, [
      {
        autor: 'Ana',
        texto: 'Este mensaje debe sobrevivir al servidor',
        hora: (await mensajeGuardado).hora,
      },
    ]);
  });
});

test('el adaptador MongoDB guarda y recupera mensajes en orden cronológico', async () => {
  const documentos = [];
  const collection = {
    async insertOne(documento) {
      documentos.push(documento);
    },
    find(_query, options) {
      assert.deepEqual(options, {
        projection: { _id: 0, autor: 1, texto: 1, hora: 1 },
      });
      return {
        sort(orden) {
          assert.deepEqual(orden, { createdAt: 1, _id: 1 });
          return {
            async toArray() {
              return documentos
                .sort((a, b) => a.createdAt - b.createdAt)
                .map(({ autor, texto, hora }) => ({ autor, texto, hora }));
            },
          };
        },
      };
    },
  };
  const store = createMongoMessageStore(collection);
  const primero = {
    autor: 'Ana',
    texto: 'Primero',
    hora: '2026-10-29T10:00:00.000Z',
  };
  const segundo = {
    autor: 'Luis',
    texto: 'Segundo',
    hora: '2026-10-29T10:01:00.000Z',
  };

  await store.save(primero);
  await store.save(segundo);
  assert.deepEqual(await store.getAll(), [primero, segundo]);
});
