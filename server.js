require('dotenv').config();

const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const { MongoClient } = require('mongodb');
const { Server } = require('socket.io');

const MAX_NOMBRE_LENGTH = 30;
const MAX_MENSAJE_LENGTH = 500;

function getLocalNetworkAddresses(networkInterfaces = os.networkInterfaces()) {
  return Object.values(networkInterfaces)
    .flat()
    .filter((address) => address && !address.internal
      && (address.family === 'IPv4' || address.family === 4))
    .map((address) => address.address);
}

function createInMemoryMessageStore() {
  const mensajes = [];

  return {
    async save(mensaje) {
      mensajes.push({ ...mensaje });
    },
    async getAll() {
      return mensajes.map((mensaje) => ({ ...mensaje }));
    },
  };
}

function createMongoMessageStore(collection) {
  return {
    async save(mensaje) {
      await collection.insertOne({
        ...mensaje,
        createdAt: new Date(mensaje.hora),
      });
    },
    async getAll() {
      return collection
        .find({}, { projection: { _id: 0, autor: 1, texto: 1, hora: 1 } })
        .sort({ createdAt: 1, _id: 1 })
        .toArray();
    },
  };
}

function createChatServer({ messageStore } = {}) {
  if (!messageStore || typeof messageStore.save !== 'function' || typeof messageStore.getAll !== 'function') {
    throw new TypeError('Se requiere un almacenamiento de mensajes con los métodos save y getAll.');
  }

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const usuarios = new Map();

  app.use(express.static(path.join(__dirname, 'public')));

  io.on('connection', (socket) => {
    console.log('Se conectó:', socket.id);

    socket.on('entrar', async (nombre, responder) => {
      const nombreNormalizado = typeof nombre === 'string' ? nombre.trim() : '';
      const nombreExiste = [...usuarios.values()].some(
        (usuario) => usuario.toLocaleLowerCase('es') === nombreNormalizado.toLocaleLowerCase('es'),
      );
      let error;

      if (!nombreNormalizado) {
        error = 'Escribe un nombre para entrar al chat.';
      } else if (nombreNormalizado.length > MAX_NOMBRE_LENGTH) {
        error = `El nombre debe tener ${MAX_NOMBRE_LENGTH} caracteres o menos.`;
      } else if (nombreExiste) {
        error = 'Ese nombre ya está conectado. Elige otro.';
      } else if (usuarios.has(socket.id)) {
        error = 'Ya ingresaste al chat.';
      }

      if (error) {
        if (typeof responder === 'function') responder({ ok: false, error });
        return;
      }

      let historial;
      try {
        historial = await messageStore.getAll();
      } catch (error) {
        console.error('No se pudo cargar el historial de mensajes:', error);
        if (typeof responder === 'function') {
          responder({ ok: false, error: 'No se pudo cargar el historial. Intenta de nuevo.' });
        }
        return;
      }

      usuarios.set(socket.id, nombreNormalizado);
      socket.emit('historial', historial);
      io.emit('sistema', `${nombreNormalizado} se unió al chat`);
      io.emit('usuarios', [...usuarios.values()]);
      if (typeof responder === 'function') responder({ ok: true });
    });

    socket.on('mensaje', async (texto) => {
      const autor = usuarios.get(socket.id);
      const textoNormalizado = typeof texto === 'string' ? texto.trim() : '';

      if (!autor || !textoNormalizado) return;
      if (textoNormalizado.length > MAX_MENSAJE_LENGTH) {
        socket.emit('sistema', `El mensaje debe tener ${MAX_MENSAJE_LENGTH} caracteres o menos.`);
        return;
      }

      const mensaje = {
        autor,
        texto: textoNormalizado,
        hora: new Date().toISOString(),
      };

      try {
        await messageStore.save(mensaje);
      } catch (error) {
        console.error('No se pudo guardar el mensaje en MongoDB:', error);
        socket.emit('sistema', 'No se pudo guardar el mensaje. Intenta enviarlo de nuevo.');
        return;
      }

      io.emit('mensaje', mensaje);
    });

    socket.on('escribiendo', () => {
      const nombre = usuarios.get(socket.id);
      if (nombre) socket.broadcast.emit('escribiendo', nombre);
    });

    socket.on('disconnect', () => {
      const nombre = usuarios.get(socket.id);
      usuarios.delete(socket.id);
      console.log('Se desconectó:', socket.id);

      if (nombre) {
        io.emit('sistema', `${nombre} salió del chat`);
        io.emit('usuarios', [...usuarios.values()]);
      }
    });
  });

  return { app, server, io, usuarios };
}

async function startServer() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Falta MONGODB_URI. Configura la URI de conexión a MongoDB en el archivo .env.');
  }

  const mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  console.log('Conexión a MongoDB establecida.');

  const database = mongoClient.db(process.env.MONGODB_DB || 'chat_socketio');
  const collection = database.collection('mensajes');
  await collection.createIndex({ createdAt: 1, _id: 1 });

  const { server } = createChatServer({
    messageStore: createMongoMessageStore(collection),
  });
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);

    if (process.env.RENDER_EXTERNAL_URL) {
      console.log(`Acceso desde Internet: ${process.env.RENDER_EXTERNAL_URL}`);
      return;
    }

    for (const address of getLocalNetworkAddresses()) {
      console.log(`Acceso desde la misma red: http://${address}:${PORT}`);
    }
  });

  const cerrar = () => {
    server.close(async () => {
      await mongoClient.close();
      process.exit(0);
    });
  };

  process.once('SIGINT', cerrar);
  process.once('SIGTERM', cerrar);
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('No se pudo iniciar el chat:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  createChatServer,
  createInMemoryMessageStore,
  createMongoMessageStore,
  getLocalNetworkAddresses,
};
