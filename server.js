

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const servidor = http.createServer(app);
const io = new Server(servidor);

const PORT = process.env.PORT || 3000;

// Mostrar los archivos del juego
app.use(express.static("public"));

// Lista de jugadores conectados
let jugadores = [];

// Identificador del anfitrión actual
let anfitrionId = null;


// Función para actualizar la información de la sala
function actualizarSala() {
    io.emit("lista-jugadores", jugadores);

    io.emit(
        "personajes-ocupados",
        jugadores.map(j => j.personaje)
    );

    io.emit("anfitrion-actual", anfitrionId);

    // Enviar el progreso individual al administrador
    if (anfitrionId !== null) {
        const progreso = jugadores
            .filter(j => j.id !== anfitrionId)
            .map(j => ({
                id: j.id,
                nombre: j.nombre,
                personaje: j.personaje,
                respondidas: j.respondidas || 0,
                puntos: j.puntos || 0,
                errores: j.errores || 0
            }));

        io.to(anfitrionId).emit("progreso-jugadores", progreso);
    }
}


// Conexión de jugadores
io.on("connection", (socket) => {

    console.log("Un jugador se ha conectado:", socket.id);

    // Enviar información actual al jugador que acaba de conectar
    socket.emit("lista-jugadores", jugadores);

    socket.emit(
        "personajes-ocupados",
        jugadores.map(j => j.personaje)
    );

    socket.emit("anfitrion-actual", anfitrionId);


    // INGRESAR A LA SALA
    socket.on("ingresar-jugador", (datos) => {

        const nombre = String(datos.nombre || "").trim();
        const personaje = Number(datos.personaje);

        if (
            !nombre ||
            !Number.isInteger(personaje) ||
            personaje < 1 ||
            personaje > 30
        ) {
            socket.emit("error-ingreso", "Datos inválidos.");
            return;
        }

        // Evitar registrar dos veces al mismo jugador
        if (jugadores.some(j => j.id === socket.id)) {
            return;
        }

        // Evitar personajes ocupados
        if (jugadores.some(j => j.personaje === personaje)) {
            socket.emit(
                "error-ingreso",
                "Ese personaje ya está ocupado. Escoge otro."
            );
            return;
        }

        // Crear jugador
const jugador = {
    id: socket.id,
    nombre: nombre,
    personaje: personaje,
    respondidas: 0,
    puntos: 0,
    errores: 0
};

jugadores.push(jugador);

// El primer usuario será el anfitrión
if (anfitrionId === null) {
    anfitrionId = socket.id;
}

console.log(
    `${nombre} ingresó con el personaje ${personaje}`
);

actualizarSala();
    });

socket.on("actualizar-progreso", (datos) => {

    const jugador = jugadores.find(j => j.id === socket.id);

    if (!jugador || socket.id === anfitrionId) {
        return;
    }

    jugador.respondidas = Number(datos.respondidas) || 0;
    jugador.puntos = Number(datos.puntos) || 0;
    jugador.errores = Number(datos.errores) || 0;

    // Preparar el progreso de todos los jugadores
    const progreso = jugadores
        .filter(j => j.id !== anfitrionId)
        .map(j => ({
            id: j.id,
            nombre: j.nombre,
            personaje: j.personaje,
            respondidas: j.respondidas,
            puntos: j.puntos,
            errores: j.errores
        }));

    // Enviar los datos al anfitrión
    if (anfitrionId !== null) {
        io.to(anfitrionId).emit("progreso-jugadores", progreso);
    }

});
    // TRANSFERIR EL CARGO DE ANFITRIÓN
    // INICIAR LA PARTIDA
socket.on("iniciar-partida", () => {

    // Solo el anfitrión puede iniciar
    if (socket.id !== anfitrionId) {
        return;
    }

    // Verificar que haya jugadores conectados
    if (jugadores.length === 0) {
        return;
    }

    console.log("El anfitrión ha iniciado la partida");

    // Avisar a todos los jugadores
    io.emit("partida-iniciada");

});
    socket.on("transferir-anfitrion", (nuevoAnfitrionId) => {

        // Solo el anfitrión actual puede transferir el cargo
        if (socket.id !== anfitrionId) {
            return;
        }

        // Verificar que el nuevo anfitrión esté conectado
        const nuevoAnfitrion = jugadores.find(
            j => j.id === nuevoAnfitrionId
        );

        if (!nuevoAnfitrion) {
            return;
        }

        // Cambiar anfitrión
        anfitrionId = nuevoAnfitrionId;

        console.log(
            `${nuevoAnfitrion.nombre} ahora es el anfitrión`
        );

        actualizarSala();
    });


    // DESCONEXIÓN DE JUGADORES
    socket.on("disconnect", () => {

        const jugadorDesconectado = jugadores.find(
            j => j.id === socket.id
        );

        jugadores = jugadores.filter(
            jugador => jugador.id !== socket.id
        );

        if (jugadorDesconectado) {
            console.log(
                `${jugadorDesconectado.nombre} se desconectó`
            );
        }

        // Si se desconectó el anfitrión,
        // el siguiente jugador conectado hereda el cargo
        if (anfitrionId === socket.id) {

            if (jugadores.length > 0) {
                anfitrionId = jugadores[0].id;

                console.log(
                    `${jugadores[0].nombre} ahora es el anfitrión`
                );

            } else {
                anfitrionId = null;
            }
        }

        actualizarSala();
    });

});


// Iniciar servidor
servidor.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Escape School funcionando en http://localhost:${PORT}`
    );
});
