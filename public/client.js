// ============================================================
//  TALLER: Chat en tiempo real con Socket.IO
//  ARCHIVO: public/client.js  (lado cliente / navegador)
// ============================================================

// Abre la conexión WebSocket con el servidor.
const socket = io();

const login = document.getElementById('login');
const chat = document.getElementById('chat');
const formLogin = document.getElementById('form-login');
const inputNombre = document.getElementById('input-nombre');
const formMensaje = document.getElementById('form-mensaje');
const inputMensaje = document.getElementById('input-mensaje');
const mensajes = document.getElementById('mensajes');
const listaUsuarios = document.getElementById('lista-usuarios');
const escribiendo = document.getElementById('escribiendo');

let miNombre = '';

// --- Entrar al chat -----------------------------------------
formLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  miNombre = inputNombre.value.trim();
  if (!miNombre) return;

  // TODO 1 — Emitir el evento 'entrar' al servidor con miNombre.
  // socket.emit(...)

  login.classList.add('oculto');
  chat.classList.remove('oculto');
  inputMensaje.focus();
});

// --- Enviar mensaje -----------------------------------------
formMensaje.addEventListener('submit', (e) => {
  e.preventDefault();
  const texto = inputMensaje.value.trim();
  if (!texto) return;

  // TODO 2 — Emitir el evento 'mensaje' con el texto.
  // socket.emit(...)

  inputMensaje.value = '';
});

// --- Avisar que estoy escribiendo ---------------------------
inputMensaje.addEventListener('input', () => {
  // TODO 3 — Emitir 'escribiendo' con miNombre.
});

// --- Recibir del servidor -----------------------------------

// TODO 4 — Escuchar 'mensaje' y pintarlo con pintarMensaje(data).
// socket.on('mensaje', (data) => { ... });

// TODO 5 — Escuchar 'sistema' (texto) y pintarlo con pintarSistema(texto).

// TODO 6 — Escuchar 'usuarios' (array de nombres) y pintar la lista
//          en #lista-usuarios.

// TODO 7 — Escuchar 'escribiendo' (nombre) y mostrar
//          "Fulano está escribiendo..." durante 1.5 segundos.

// --- Helpers (ya hechos, úsalos) ----------------------------

function pintarMensaje({ autor, texto, hora }) {
  const li = document.createElement('li');
  li.className = autor === miNombre ? 'mensaje propio' : 'mensaje';
  li.innerHTML = `
    <span class="autor"></span>
    <span class="texto"></span>
    <time></time>`;
  li.querySelector('.autor').textContent = autor;
  li.querySelector('.texto').textContent = texto;
  li.querySelector('time').textContent = formatearHora(hora);
  mensajes.appendChild(li);
  mensajes.scrollTop = mensajes.scrollHeight;
}

function pintarSistema(texto) {
  const li = document.createElement('li');
  li.className = 'sistema';
  li.textContent = texto;
  mensajes.appendChild(li);
  mensajes.scrollTop = mensajes.scrollHeight;
}

function formatearHora(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
