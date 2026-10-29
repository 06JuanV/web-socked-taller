const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const MAX_NOMBRE_LENGTH = 30;
const MAX_MENSAJE_LENGTH = 500;
const MAX_HISTORIAL = 20;

function createChatServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const usuarios = new Map();
  const historial = [];

  app.use(express.static(path.join(__dirname, 'public')));

  io.on('connection', (socket) => {
    console.log('Se conectó:', socket.id);

    socket.on('entrar', (nombre, responder) => {
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

      usuarios.set(socket.id, nombreNormalizado);
      socket.emit('historial', [...historial]);
      io.emit('sistema', `${nombreNormalizado} se unió al chat`);
      io.emit('usuarios', [...usuarios.values()]);
      if (typeof responder === 'function') responder({ ok: true });
    });

    socket.on('mensaje', (texto) => {
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

      historial.push(mensaje);
      if (historial.length > MAX_HISTORIAL) historial.shift();
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

if (require.main === module) {
  const { server } = createChatServer();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

module.exports = { createChatServer };
