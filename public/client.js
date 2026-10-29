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
const errorLogin = document.getElementById('error-login');

let miNombre = '';
let temporizadorEscribiendo;

// --- Entrar al chat -----------------------------------------
formLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  miNombre = inputNombre.value.trim();
  if (!miNombre) return;

  errorLogin.textContent = '';
  socket.emit('entrar', miNombre, (respuesta) => {
    if (!respuesta.ok) {
      errorLogin.textContent = respuesta.error;
      return;
    }

    login.classList.add('oculto');
    chat.classList.remove('oculto');
    inputMensaje.focus();
  });
});

// --- Enviar mensaje -----------------------------------------
formMensaje.addEventListener('submit', (e) => {
  e.preventDefault();
  const texto = inputMensaje.value.trim();
  if (!texto) return;

  socket.emit('mensaje', texto);
  inputMensaje.value = '';
});

// --- Avisar que estoy escribiendo ---------------------------
inputMensaje.addEventListener('input', () => {
  if (inputMensaje.value.trim()) socket.emit('escribiendo');
});

// --- Recibir del servidor -----------------------------------
socket.on('mensaje', pintarMensaje);
socket.on('historial', (historial) => {
  historial.forEach(pintarMensaje);
});
socket.on('sistema', pintarSistema);
socket.on('usuarios', (usuarios) => {
  const elementos = usuarios.map((nombre) => {
    const li = document.createElement('li');
    li.textContent = nombre;
    return li;
  });
  listaUsuarios.replaceChildren(...elementos);
});
socket.on('escribiendo', (nombre) => {
  escribiendo.textContent = `${nombre} está escribiendo...`;
  clearTimeout(temporizadorEscribiendo);
  temporizadorEscribiendo = setTimeout(() => {
    escribiendo.textContent = '';
  }, 1500);
});

// --- Helpers (ya hechos, úsalos) ----------------------------

function pintarMensaje({ autor, texto, hora }) {
  const li = document.createElement('li');
  li.className = autor === miNombre ? 'mensaje propio' : 'mensaje';
  const autorElemento = document.createElement('span');
  autorElemento.className = 'autor';
  autorElemento.textContent = autor;
  const textoElemento = document.createElement('span');
  textoElemento.className = 'texto';
  textoElemento.textContent = texto;
  const horaElemento = document.createElement('time');
  horaElemento.textContent = formatearHora(hora);
  li.append(autorElemento, textoElemento, horaElemento);
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
