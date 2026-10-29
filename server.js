// ============================================================
//  TALLER: Chat en tiempo real con Socket.IO
//  ARCHIVO: server.js  (lado servidor)
// ============================================================
//  Busca los comentarios "TODO" y complétalos.
//  No borres los comentarios: son tu guía.
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.IO necesita "montarse" sobre el servidor HTTP,
// porque el WebSocket nace de una petición HTTP que se "actualiza" (upgrade).
const io = new Server(server);

// Servimos la carpeta public como archivos estáticos (el frontend).
app.use(express.static('public'));

// Lista en memoria de usuarios conectados: socket.id -> nombre
const usuarios = new Map();

// ------------------------------------------------------------
// io.on('connection') se dispara UNA VEZ por cada cliente que entra.
// El objeto `socket` representa a ESE cliente en particular.
// ------------------------------------------------------------
io.on('connection', (socket) => {
  console.log('Se conectó:', socket.id);

  // TODO 1 — Escuchar el evento 'entrar' que manda el cliente con su nombre.
  //   - Guarda el nombre en el Map `usuarios`.
  //   - Avisa a TODOS (io.emit) con el evento 'sistema' un mensaje tipo
  //     `${nombre} se unió al chat`.
  //   - Manda a todos la lista actualizada con el evento 'usuarios'
  //     usando [...usuarios.values()]
  //
  // socket.on('entrar', (nombre) => { ... });


  // TODO 2 — Escuchar el evento 'mensaje' que manda el cliente.
  //   Debes reenviarlo a todos con io.emit('mensaje', {...}) incluyendo:
  //     { autor, texto, hora }   // hora: new Date().toISOString()
  //   OJO: nunca confíes en el autor que manda el cliente;
  //        tómalo de `usuarios.get(socket.id)`.
  //
  // socket.on('mensaje', (texto) => { ... });


  // TODO 3 — Escuchar 'escribiendo' y avisar SOLO a los demás
  //   (pista: socket.broadcast.emit, no io.emit).


  // TODO 4 — Manejar la desconexión.
  //   Evento 'disconnect': borra el usuario del Map, avisa por 'sistema'
  //   y vuelve a mandar la lista de 'usuarios'.
  socket.on('disconnect', () => {
    console.log('Se desconectó:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
