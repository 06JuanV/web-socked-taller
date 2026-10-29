# Chat en tiempo real con Socket.IO

Aplicación web de chat multiusuario construida con Node.js, Express y Socket.IO.
Los mensajes se envían en tiempo real; el servidor asigna el autor y la hora,
mantiene la lista de personas conectadas y conserva el historial en MongoDB para
que los mensajes sigan disponibles al volver a abrir o reiniciar el servidor.

## Datos de entrega

- **Estudiante:** Juan José Valencia, Catalina Troncoso, Jhon Alexander Misas, David Mahecha, Juan Camilo Lopez
- **Códigos:** 2220242041, 2220242001, 2220242047, 2220242008, 2220242033
- **Materia / grupo:** Ingeniería de Software
- **Fecha:** 29/10/2026
- **Repositorio propio de entrega:** <https://github.com/06JuanV/web-socked-taller>
- **Versión de Node usada para validar:** v26.10.0

> Completa tu nombre, código y materia antes de entregar. La URL indicada es el
> repositorio público que compartiste.

## Requisitos

- Node.js 20.19 o superior (requisito del driver de MongoDB)
- npm
- MongoDB local o una instancia MongoDB Atlas accesible desde el servidor

## Instalación y ejecución

```bash
git clone https://github.com/06JuanV/web-socked-taller.git
cd web-socked-taller
npm install
```

1. Copia `.env.example` como `.env` (en PowerShell: `Copy-Item .env.example .env`).
2. Configura `MONGODB_URI` con la URI de tu MongoDB. Para Atlas, usa la URI de
   conexión del clúster; para MongoDB local, puedes dejar el valor de ejemplo.
3. Si la URI incluye usuario y contraseña, codifica los caracteres especiales
   de esas credenciales para URL. No publiques el archivo `.env`.
   En MongoDB Atlas, crea un usuario de base de datos y autoriza la IP desde la
   que se ejecutará el servidor en **Network Access**.
4. Inicia el servidor:

   ```bash
   npm start
   ```

Abre <http://localhost:3000> en dos ventanas o navegadores distintos. Escribe un
nombre diferente en cada uno para probar el chat entre varias personas. Al
reiniciar el servidor y volver a entrar, se carga desde MongoDB el historial
persistido.

En desarrollo puedes usar `npm run dev`; el archivo `.env` se mantiene local y
está excluido de Git.

## Eventos implementados

| Evento | Lo emite | Lo escucha | Datos | Destinatario |
|---|---|---|---|---|
| `entrar` | Cliente | Servidor | Nombre; recibe confirmación `{ ok, error? }` | Servidor |
| `historial` | Servidor | Cliente | Mensajes persistidos en MongoDB, en orden cronológico | Solo el cliente que acaba de entrar |
| `sistema` | Servidor | Cliente | Texto de ingreso o salida | Todos los conectados |
| `mensaje` | Cliente y servidor | Servidor y clientes | El cliente envía solo el texto; el servidor publica `{ autor, texto, hora }` | Todos los conectados |
| `usuarios` | Servidor | Cliente | Arreglo de nombres conectados | Todos los conectados |
| `escribiendo` | Cliente y servidor | Servidor y clientes | El servidor determina el nombre | Todos menos quien está escribiendo |

El servidor valida y normaliza los nombres, evita nombres duplicados, limita la
longitud de nombres y mensajes, y obtiene el autor del `socket.id` asociado. La
colección `mensajes` de MongoDB guarda cada mensaje antes de difundirlo. La lista
de usuarios activos sí vive en memoria y se reconstruye cuando las personas se
conectan de nuevo. Los eventos informativos de entrada/salida no se guardan;
se conserva el historial de mensajes de chat.

## Retos del taller

- [x] **Reto 1:** entrar con nombre y avisar al chat.
- [x] **Reto 2:** enviar y recibir mensajes en tiempo real.
- [x] **Reto 3:** actualizar la lista de conectados.
- [x] **Reto 4:** mostrar el indicador de escritura únicamente a los demás.
- [x] **Reto 5:** retirar al usuario y avisar cuando se desconecta.
- [x] **Autor definido por el servidor:** el cliente transmite el texto, no el autor.

### Retos extra

- **Historial persistente:** se guarda en MongoDB y se envía, en orden, a quien
  acaba de entrar; los mensajes sobreviven al cierre del navegador y al reinicio
  del servidor.
- **Nombres únicos:** no se permite el ingreso mientras otro usuario conectado
  tenga el mismo nombre (sin distinguir mayúsculas y minúsculas).

## Pruebas

```bash
npm test
```

Las pruebas cubren ingreso, nombres repetidos, lista de usuarios, mensajes con
autor asignado por el servidor, escritura visible solo para otros, recuperación
del historial después de recrear el servidor, almacenamiento cronológico y
desconexión limpia. La recuperación de MongoDB en producción requiere configurar
`MONGODB_URI`.

### Comprobar persistencia en MongoDB

1. Configura `.env` con una URI válida y ejecuta `npm start`.
2. Entra al chat y envía un mensaje fácil de reconocer.
3. Detén el servidor con `Ctrl+C` y vuelve a iniciarlo con `npm start`.
4. Entra al chat con cualquier nombre disponible: el mensaje anterior debe
   aparecer en el historial.
5. En MongoDB Compass, revisa la base `chat_socketio` y la colección `mensajes`.

El historial se envía al usuario después de que este entra con su nombre; por
eso, al reabrir el sitio se vuelve a escribir el nombre antes de ver los
mensajes guardados.

## Capturas para la entrega

![Dos usuarios conectados y chateando](capturas/chat.png)

## Preguntas de sustentación

**1. ¿En qué se diferencian `socket.emit`, `socket.broadcast.emit` e `io.emit`?**

`socket.emit` envía un evento únicamente al cliente asociado a ese socket.
`socket.broadcast.emit` lo envía a todos los clientes conectados excepto al
socket que lo originó. `io.emit` lo envía a todos los clientes conectados.

**2. ¿Por qué el servidor no puede confiar en el nombre que manda el cliente?**

El navegador está bajo el control de quien lo usa y puede modificarse o enviar
eventos manualmente. Por eso el cliente solo manda el texto y el servidor usa el
nombre previamente asociado al `socket.id`.

**3. ¿Qué pasa con la lista de usuarios si el servidor se reinicia? ¿Cómo se
conserva el historial de mensajes?**

La lista en memoria se pierde y los usuarios vuelven a aparecer al conectarse.
Los mensajes sí se conservan porque se almacenan en la colección `mensajes` de
MongoDB y se vuelven a consultar cuando entra un usuario.

**4. ¿Qué es el fallback a long-polling y cuándo entra en acción?**

Socket.IO puede transportar eventos mediante HTTP long-polling cuando no logra
establecer o mantener WebSocket, por ejemplo si un proxy o una red bloquea la
conexión. La librería administra el transporte y la reconexión.

**5. Si hubiera 10.000 usuarios, ¿por qué `io.emit` en cada tecla presionada
sería un problema?**

Cada tecla multiplicaría los eventos enviados a los clientes conectados,
consumiendo ancho de banda y capacidad de procesamiento. Conviene limitar la
frecuencia de los avisos, agruparlos o usar salas para reducir destinatarios.

## Estado antes de publicar

- [x] `node_modules/` está excluido mediante `.gitignore`.
- [x] La aplicación y las pruebas funcionan localmente (las pruebas usan un
  almacén aislado; para ejecutar el servidor real hay que configurar MongoDB).
- [ ] Configurar `MONGODB_URI` en el entorno de ejecución/despliegue sin subir
  credenciales al repositorio.
- [x] Repositorio público: <https://github.com/06JuanV/web-socked-taller>
- [x] Captura auténtica con dos usuarios: [capturas/chat.png](capturas/chat.png).
- [x] Completar los datos del estudiante y la materia.
- [x] Historial con más de seis commits descriptivos.

## Fuentes

- [Documentación de Socket.IO](https://socket.io/docs/v4/)
- Guía del taller: <https://juanbonilla1305.github.io/taller-chat-socketio/>
