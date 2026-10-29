const assert = require('node:assert/strict');
const { test } = require('node:test');
const { io: createClient } = require('socket.io-client');
const { createChatServer } = require('../server');

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

test('maneja ingreso, mensajes, escritura, historial y desconexión', async () => {
  const { server, io, usuarios } = createChatServer();
  const clientes = [];

  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${server.address().port}`;

  try {
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
    assert.equal(mensajesAnteriores.length, 20);
    assert.equal(mensajesAnteriores[0].texto, 'Mensaje 1');
    assert.equal(mensajesAnteriores.at(-1).texto, 'Mensaje 20');
    assert.equal(usuarios.size, 3);

    const desconexionSistema = waitForEvent(ana, 'sistema');
    const desconexionUsuarios = waitForEvent(ana, 'usuarios');
    luis.disconnect();
    assert.equal(await desconexionSistema, 'Luis salió del chat');
    assert.deepEqual(await desconexionUsuarios, ['Ana', 'Carla']);
    assert.equal(usuarios.size, 2);
  } finally {
    clientes.forEach((cliente) => cliente.disconnect());
    await new Promise((resolve) => io.close(resolve));
  }
});
