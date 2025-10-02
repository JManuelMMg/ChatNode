var socket = io.connect();

var persona = document.getElementById('persona');
var appChat = document.getElementById('app-chat');
var panelBienvenida = document.getElementById('panel-bienvenida');
var usuario = document.getElementById('usuario');
var mensaje = document.getElementById('mensaje');
var botonEnviar = document.getElementById('boton-enviar');
var escribiendoMensaje = document.getElementById('escribiendo-mensaje');
var output = document.getElementById('output');

// Variables para notificaciones
var notificacionesHabilitadas = true;
var usuarioActual = '';
var mensajesNoLeidos = 0;
var tituloOriginal = document.title;

// Variables para historial persistente
var historialMensajes = [];
var maxMensajesHistorial = 200; // Máximo de mensajes a guardar
var sessionId = 'chat_session_' + Date.now();
var isNewSession = true;

// Objeto para almacenar colores de usuarios
var coloresUsuarios = {};

// Elementos de control de notificaciones
var toggleNotificaciones = document.getElementById('toggle-notificaciones');
var testSonido = document.getElementById('test-sonido');
var contadorMensajes = document.getElementById('contador-mensajes');

// Función para generar color único basado en el nombre del usuario
function generarColorUsuario(nombre) {
    if (coloresUsuarios[nombre]) {
        return coloresUsuarios[nombre];
    }
    
    // Generar hash del nombre para consistencia
    var hash = 0;
    for (var i = 0; i < nombre.length; i++) {
        hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convertir hash a colores oscuros para mejor contraste con texto blanco
    var hue = Math.abs(hash) % 360;
    var saturation = 60 + (Math.abs(hash) % 30); // 60-90% para colores más vibrantes
    var lightness = 25 + (Math.abs(hash) % 15); // 25-40% para colores oscuros
    
    var color = 'hsl(' + hue + ', ' + saturation + '%, ' + lightness + '%)';
    
    // Almacenar color para este usuario
    coloresUsuarios[nombre] = color;
    
    return color;
}

// Función para obtener la hora actual formateada
function obtenerHoraActual() {
    var ahora = new Date();
    var horas = ahora.getHours().toString().padStart(2, '0');
    var minutos = ahora.getMinutes().toString().padStart(2, '0');
    return horas + ':' + minutos;
}

// Función para reproducir sonido de notificación agradable y fuerte
function reproducirSonidoNotificacion() {
    try {
        // Crear un contexto de audio
        var audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Crear una melodía agradable con múltiples notas
        var notas = [
            {freq: 523.25, duration: 0.15}, // Do5
            {freq: 659.25, duration: 0.15}, // Mi5
            {freq: 783.99, duration: 0.2}  // Sol5
        ];
        
        var tiempoActual = audioContext.currentTime;
        
        // Reproducir cada nota de la melodía
        notas.forEach(function(nota, index) {
            // Crear osciladores para cada nota
            var oscillator1 = audioContext.createOscillator();
            var oscillator2 = audioContext.createOscillator();
            var gainNode = audioContext.createGain();
            var filterNode = audioContext.createBiquadFilter();
            
            // Conectar los nodos
            oscillator1.connect(gainNode);
            oscillator2.connect(gainNode);
            gainNode.connect(filterNode);
            filterNode.connect(audioContext.destination);
            
            // Configurar frecuencias (nota principal + armónico)
            oscillator1.frequency.setValueAtTime(nota.freq, tiempoActual);
            oscillator2.frequency.setValueAtTime(nota.freq * 2, tiempoActual); // Octava superior
            
            // Usar ondas más suaves
            oscillator1.type = 'sine';
            oscillator2.type = 'sine';
            
            // Configurar filtro para sonido más agradable
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(2000, tiempoActual);
            filterNode.Q.setValueAtTime(0.5, tiempoActual);
            
            // Configurar volumen con envelope suave
            gainNode.gain.setValueAtTime(0, tiempoActual);
            gainNode.gain.linearRampToValueAtTime(0.7, tiempoActual + 0.02); // Attack rápido
            gainNode.gain.linearRampToValueAtTime(0.5, tiempoActual + nota.duration * 0.7); // Sustain
            gainNode.gain.linearRampToValueAtTime(0, tiempoActual + nota.duration); // Release suave
            
            // Reproducir la nota
            oscillator1.start(tiempoActual);
            oscillator2.start(tiempoActual);
            oscillator1.stop(tiempoActual + nota.duration);
            oscillator2.stop(tiempoActual + nota.duration);
            
            // Incrementar tiempo para la siguiente nota
            tiempoActual += nota.duration + 0.05; // Pequeña pausa entre notas
        });
        
        // Agregar un acorde final más fuerte
        setTimeout(function() {
            var acordeFrecuencias = [523.25, 659.25, 783.99]; // Do-Mi-Sol
            var acordeOsciladores = [];
            var acordeGain = audioContext.createGain();
            var acordeFilter = audioContext.createBiquadFilter();
            
            // Crear osciladores para el acorde
            acordeFrecuencias.forEach(function(freq) {
                var osc = audioContext.createOscillator();
                osc.frequency.setValueAtTime(freq, audioContext.currentTime);
                osc.type = 'sine';
                osc.connect(acordeGain);
                acordeOsciladores.push(osc);
            });
            
            acordeGain.connect(acordeFilter);
            acordeFilter.connect(audioContext.destination);
            
            acordeFilter.type = 'lowpass';
            acordeFilter.frequency.setValueAtTime(1500, audioContext.currentTime);
            acordeFilter.Q.setValueAtTime(0.3, audioContext.currentTime);
            
            // Envelope para el acorde
            acordeGain.gain.setValueAtTime(0, audioContext.currentTime);
            acordeGain.gain.linearRampToValueAtTime(0.8, audioContext.currentTime + 0.05);
            acordeGain.gain.linearRampToValueAtTime(0.6, audioContext.currentTime + 0.2);
            acordeGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
            
            // Reproducir el acorde
            acordeOsciladores.forEach(function(osc) {
                osc.start(audioContext.currentTime);
                osc.stop(audioContext.currentTime + 0.5);
            });
            
        }, 0.6); // Iniciar el acorde después de la melodía
        
    } catch (error) {
        console.log('No se pudo reproducir el sonido:', error);
    }
}

// Función para mostrar notificación del navegador
function mostrarNotificacion(titulo, mensaje, icono) {
    if (!notificacionesHabilitadas) return;
    
    // Verificar si el navegador soporta notificaciones
    if (!("Notification" in window)) {
        console.log("Este navegador no soporta notificaciones");
        return;
    }
    
    // Solo mostrar notificación si la pestaña no está activa
    if (document.hidden) {
        // Solicitar permiso para notificaciones si no se ha hecho
        if (Notification.permission === "default") {
            Notification.requestPermission().then(function(permission) {
                if (permission === "granted") {
                    crearNotificacion(titulo, mensaje, icono);
                }
            });
        } else if (Notification.permission === "granted") {
            crearNotificacion(titulo, mensaje, icono);
        }
    }
}

// Función para crear la notificación
function crearNotificacion(titulo, mensaje, icono) {
    var notificacion = new Notification(titulo, {
        body: mensaje,
        icon: icono || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'chat-notification',
        requireInteraction: false
    });
    
    // Cerrar la notificación después de 5 segundos
    setTimeout(function() {
        notificacion.close();
    }, 5000);
}

// Función para verificar si la pestaña está visible
function esPestañaVisible() {
    return !document.hidden;
}

// Función para auto-scroll suave
function autoScrollSuave() {
    var ventanaMensajes = document.getElementById('ventana-mensajes');
    if (!ventanaMensajes) return;
    
    // Calcular la posición final
    var scrollHeight = ventanaMensajes.scrollHeight;
    var clientHeight = ventanaMensajes.clientHeight;
    var maxScroll = scrollHeight - clientHeight;
    
    // Solo hacer scroll si no está cerca del final (para no interrumpir al usuario)
    var currentScroll = ventanaMensajes.scrollTop;
    var isNearBottom = (currentScroll + clientHeight) >= (scrollHeight - 100);
    
    if (isNearBottom || currentScroll === 0) {
        // Scroll suave con animación
        ventanaMensajes.scrollTo({
            top: maxScroll,
            behavior: 'smooth'
        });
    }
}

// Función para detectar si el usuario está scrolleando manualmente
function detectarScrollManual() {
    var ventanaMensajes = document.getElementById('ventana-mensajes');
    if (!ventanaMensajes) return;
    
    var scrollHeight = ventanaMensajes.scrollHeight;
    var clientHeight = ventanaMensajes.clientHeight;
    var scrollTop = ventanaMensajes.scrollTop;
    
    // Si está cerca del final, permitir auto-scroll
    return (scrollTop + clientHeight) >= (scrollHeight - 50);
}

// Función para guardar mensaje en el historial
function guardarMensajeEnHistorial(usuario, mensaje, timestamp) {
    var mensajeData = {
        usuario: usuario,
        mensaje: mensaje,
        timestamp: timestamp || new Date().toISOString(),
        sessionId: sessionId
    };
    
    historialMensajes.push(mensajeData);
    
    // Limitar el número de mensajes guardados
    if (historialMensajes.length > maxMensajesHistorial) {
        historialMensajes = historialMensajes.slice(-maxMensajesHistorial);
    }
    
    // Guardar en localStorage
    try {
        localStorage.setItem('chat_historial', JSON.stringify(historialMensajes));
        localStorage.setItem('chat_session_id', sessionId);
        localStorage.setItem('chat_usuario_actual', usuarioActual);
    } catch (error) {
        console.log('Error al guardar en localStorage:', error);
    }
}

// Función para cargar historial desde localStorage
function cargarHistorial() {
    try {
        var historialGuardado = localStorage.getItem('chat_historial');
        var sessionGuardada = localStorage.getItem('chat_session_id');
        var usuarioGuardado = localStorage.getItem('chat_usuario_actual');
        
        if (historialGuardado && sessionGuardada) {
            historialMensajes = JSON.parse(historialGuardado);
            if (usuarioGuardado) {
                usuarioActual = usuarioGuardado;
                usuario.value = usuarioActual;
            }
            mostrarHistorialEnPantalla();
            console.log('Historial cargado:', historialMensajes.length, 'mensajes');
            isNewSession = false;
        } else {
            console.log('No hay historial previo');
            isNewSession = true;
        }
    } catch (error) {
        console.log('Error al cargar historial:', error);
        historialMensajes = [];
        isNewSession = true;
    }
}

// Función para mostrar el historial en pantalla
function mostrarHistorialEnPantalla() {
    if (historialMensajes.length === 0) return;
    
    output.innerHTML = ''; // Limpiar contenido actual
    
    // Agregar indicador de mensajes cargados
    if (historialMensajes.length > 0) {
        var indicadorElement = document.createElement('div');
        indicadorElement.style.cssText = 'text-align: center; padding: 15px; color: #a8d8ff; font-style: italic; border-bottom: 1px solid rgba(168, 216, 255, 0.3); margin-bottom: 15px; background: linear-gradient(135deg, rgba(168, 216, 255, 0.1), rgba(255, 119, 198, 0.05)); border-radius: 10px;';
        indicadorElement.innerHTML = '📜 ' + historialMensajes.length + ' mensajes anteriores cargados';
        output.appendChild(indicadorElement);
    }
    
    historialMensajes.forEach(function(mensajeData) {
        var mensajeElement = document.createElement('p');
        mensajeElement.innerHTML = '<strong>' + mensajeData.usuario + ': </strong>' + mensajeData.mensaje;
        output.appendChild(mensajeElement);
    });
    
    // Hacer scroll hacia abajo
    var ventanaMensajes = document.getElementById('ventana-mensajes');
    ventanaMensajes.scrollTop = ventanaMensajes.scrollHeight;
}

// Función para limpiar historial y iniciar chat nuevo
function iniciarChatNuevo() {
    try {
        localStorage.removeItem('chat_historial');
        localStorage.removeItem('chat_session_id');
        localStorage.removeItem('chat_usuario_actual');
        historialMensajes = [];
        usuarioActual = '';
        mensajesNoLeidos = 0;
        actualizarContadorMensajes();
        document.title = tituloOriginal;
        
        // Reconectar socket si es necesario
        if (!socket || !socket.connected) {
            reconectarSocket();
        }
        
        // Limpiar la ventana de mensajes
        output.innerHTML = '';
        
        // Mostrar mensaje de chat nuevo
        var mensajeNuevoElement = document.createElement('div');
        mensajeNuevoElement.style.cssText = 'text-align: center; padding: 20px; color: #a8d8ff; font-weight: bold; background: linear-gradient(135deg, rgba(168, 216, 255, 0.2), rgba(255, 119, 198, 0.1)); border-radius: 15px; margin: 10px 0;';
        mensajeNuevoElement.innerHTML = '🆕 ¡Chat nuevo iniciado!';
        output.appendChild(mensajeNuevoElement);
        
        // Generar nueva sesión
        sessionId = 'chat_session_' + Date.now();
        isNewSession = true;
        
        console.log('Chat nuevo iniciado');
    } catch (error) {
        console.log('Error al iniciar chat nuevo:', error);
    }
}

// Función para cerrar completamente el chat
function cerrarChatCompleto() {
    try {
        // Desconectar del socket
        if (socket) {
            socket.disconnect();
            console.log('Socket desconectado');
        }
        
        // Limpiar historial completo
        localStorage.removeItem('chat_historial');
        localStorage.removeItem('chat_session_id');
        localStorage.removeItem('chat_usuario_actual');
        historialMensajes = [];
        usuarioActual = '';
        mensajesNoLeidos = 0;
        actualizarContadorMensajes();
        document.title = tituloOriginal;
        
        // Ocultar el chat
        var appChat = document.getElementById('app-chat');
        if (appChat) {
            appChat.classList.add('app-chat-hidden');
        }
        
        // Mostrar panel de bienvenida
        var panelBienvenida = document.getElementById('panel-bienvenida');
        if (panelBienvenida) {
            panelBienvenida.style.display = 'block';
        }
        
        // Limpiar campos
        var usuario = document.getElementById('usuario');
        var mensaje = document.getElementById('mensaje');
        if (usuario) usuario.value = '';
        if (mensaje) mensaje.value = '';
        
        // Limpiar ventana de mensajes
        var output = document.getElementById('output');
        if (output) {
            output.innerHTML = '';
        }
        
        // Limpiar contador
        var contador = document.getElementById('contador-mensajes');
        if (contador) {
            contador.textContent = '';
            contador.classList.remove('mostrar');
        }
        
        // Mostrar mensaje de confirmación
        alert('Chat cerrado completamente. Puedes iniciar una nueva sesión cuando quieras.');
        
        console.log('Chat cerrado completamente');
    } catch (error) {
        console.log('Error al cerrar chat:', error);
    }
}

// Función para reconectar el socket
function reconectarSocket() {
    try {
        // Desconectar socket anterior si existe
        if (socket) {
            socket.disconnect();
        }
        
        // Crear nueva conexión
        socket = io.connect();
        
        // Reconfigurar event listeners del socket
        configurarEventListenersSocket();
        
        console.log('Socket reconectado');
    } catch (error) {
        console.log('Error al reconectar socket:', error);
    }
}

// Función para configurar los event listeners del socket
function configurarEventListenersSocket() {
    // Event listener para cuando se conecta
    socket.on('connect', function() {
        console.log('Conectado al servidor');
    });
    
    // Event listener para cuando se desconecta
    socket.on('disconnect', function() {
        console.log('Desconectado del servidor');
    });
    
    // Event listener para mensajes del chat
    socket.on('chat', function(data) {
        // Generar color único para el usuario
        var colorUsuario = generarColorUsuario(data.usuario);
        var hora = obtenerHoraActual();
        
        // Crear elemento de mensaje con color y hora
        var mensajeElement = document.createElement('div');
        mensajeElement.className = 'mensaje-usuario';
        mensajeElement.style.cssText = 'margin: 8px 0; padding: 12px 16px; border-radius: 15px; background: ' + colorUsuario + '; border-left: 4px solid ' + colorUsuario + '; position: relative; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);';
        
        // Contenido del mensaje
        var contenidoMensaje = document.createElement('div');
        contenidoMensaje.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;';
        
        // Nombre del usuario con color
        var nombreElement = document.createElement('strong');
        nombreElement.style.color = colorUsuario;
        nombreElement.textContent = data.usuario;
        
        // Hora del mensaje
        var horaElement = document.createElement('span');
        horaElement.style.cssText = 'font-size: 11px; color: rgba(255, 255, 255, 0.7); background: rgba(0, 0, 0, 0.2); padding: 2px 8px; border-radius: 10px;';
        horaElement.textContent = hora;
        
        // Texto del mensaje
        var textoElement = document.createElement('div');
        textoElement.style.cssText = 'color: white; word-wrap: break-word;';
        textoElement.textContent = data.mensaje;
        
        // Ensamblar el mensaje
        contenidoMensaje.appendChild(nombreElement);
        contenidoMensaje.appendChild(horaElement);
        mensajeElement.appendChild(contenidoMensaje);
        mensajeElement.appendChild(textoElement);
        
        output.appendChild(mensajeElement);
        
        // Guardar mensaje en historial
        guardarMensajeEnHistorial(data.usuario, data.mensaje);
        
        // Mostrar notificaciones si están habilitadas
        if (notificacionesHabilitadas && data.usuario !== usuarioActual) {
            mostrarNotificacionVisual(data.usuario, data.mensaje);
            mensajesNoLeidos++;
            actualizarContadorMensajes();
        }
        
        // Auto-scroll suave
        autoScrollSuave();
    });
    
    // Event listener para cuando alguien está escribiendo
    socket.on('escribiendo', function(data) {
        if (data.usuario !== usuarioActual) {
            escribiendoMensaje.innerHTML = '<p><em>' + data.usuario + ' está escribiendo...</em></p>';
            setTimeout(function() {
                escribiendoMensaje.innerHTML = '';
            }, 3000);
        }
    });
    
    // Event listener para typing (compatible con el servidor)
    socket.on('typing', function(data) {
        if (data.texto) {
            escribiendoMensaje.innerHTML = '<p><em>' + data.nombre + ' esta escribiendo un mensaje...</em></p>';
        } else {
            escribiendoMensaje.innerHTML = '';
        }
    });
}

// Función para limpiar historial al cerrar la aplicación
function limpiarHistorialCompleto() {
    try {
        localStorage.removeItem('chat_historial');
        localStorage.removeItem('chat_session_id');
        localStorage.removeItem('chat_usuario_actual');
        historialMensajes = [];
        console.log('Historial completamente limpiado');
    } catch (error) {
        console.log('Error al limpiar historial:', error);
    }
}

// Función para mostrar notificación toast visual
function mostrarNotificacionToast(usuario, mensaje) {
    if (!notificacionesHabilitadas) return;
    
    // Crear elemento de notificación
    var notificacion = document.createElement('div');
    notificacion.className = 'notificacion-toast';
    notificacion.innerHTML = `
        <div class="titulo">
            <span class="icono">💬</span>
            Nuevo mensaje de ${usuario}
        </div>
        <div class="mensaje">${mensaje}</div>
    `;
    
    // Agregar al DOM
    document.body.appendChild(notificacion);
    
    // Forzar reflow para asegurar que la animación funcione
    notificacion.offsetHeight;
    
    // Mostrar con animación
    setTimeout(function() {
        notificacion.classList.add('mostrar');
    }, 50);
    
    // Remover después de 4 segundos
    setTimeout(function() {
        notificacion.classList.remove('mostrar');
        setTimeout(function() {
            if (notificacion.parentNode) {
                notificacion.parentNode.removeChild(notificacion);
            }
        }, 400);
    }, 4000);
}

// Función para hacer parpadear el título de la pestaña
function parpadearTitulo() {
    var contador = 0;
    var intervalo = setInterval(function() {
        if (contador % 2 === 0) {
            document.title = '🔔 Nuevo mensaje - ' + tituloOriginal;
        } else {
            document.title = tituloOriginal;
        }
        contador++;
        
        if (contador >= 6) { // Parpadear 3 veces
            clearInterval(intervalo);
            document.title = tituloOriginal;
        }
    }, 500);
}

// Función para actualizar contador de mensajes no leídos
function actualizarContadorMensajes() {
    if (mensajesNoLeidos > 0) {
        contadorMensajes.textContent = mensajesNoLeidos;
        contadorMensajes.classList.add('mostrar');
    } else {
        contadorMensajes.classList.remove('mostrar');
    }
}

// Función para agregar efecto de vibración
function agregarVibracion() {
    var appChat = document.getElementById('app-chat');
    appChat.classList.add('vibracion');
    setTimeout(function() {
        appChat.classList.remove('vibracion');
    }, 500);
}

// Función para mostrar notificación visual completa
function mostrarNotificacionVisual(usuario, mensaje) {
    if (!notificacionesHabilitadas) return;
    
    // Incrementar contador de mensajes no leídos
    mensajesNoLeidos++;
    actualizarContadorMensajes();
    
    // Parpadear título si la pestaña no está activa
    if (document.hidden) {
        parpadearTitulo();
    }
    
    // Mostrar notificación toast siempre (visual)
    mostrarNotificacionToast(usuario, mensaje);
    
    // Agregar efecto de vibración
    agregarVibracion();
    
    // Reproducir sonido siempre
    reproducirSonidoNotificacion();
}

botonEnviar.addEventListener('click', function(){
  if(mensaje.value){
    socket.emit('chat', {
      mensaje: mensaje.value,
      usuario: usuario.value
    });
    mensaje.value = '';
  }
});

mensaje.addEventListener('keyup', function(){
  if(persona.value){
    socket.emit('typing', {
      nombre: usuario.value,
      texto: mensaje.value
    });
  }
});



function ingresarAlChat(){
  if(persona.value){
    panelBienvenida.style.display = "none";
    appChat.style.display = "block";
    var nombreDeUsuario = persona.value;
    usuario.value = nombreDeUsuario;
    usuario.readOnly = true;
    usuarioActual = nombreDeUsuario; // Establecer el usuario actual para las notificaciones
    
    // Reconectar socket si es necesario
    if (!socket || !socket.connected) {
      reconectarSocket();
    }
    
    // Cargar historial de mensajes
    cargarHistorial();
    
    // Inicializar notificaciones
    inicializarNotificaciones();
  }
}

// Función para inicializar notificaciones
function inicializarNotificaciones() {
  // Solicitar permisos de notificación al ingresar al chat
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then(function(permission) {
      if (permission === "granted") {
        console.log("Permisos de notificación concedidos");
      } else {
        console.log("Permisos de notificación denegados");
      }
    });
  }
  
  // Configurar título original
  tituloOriginal = document.title;
}

// Event listeners para controles de notificaciones
if (toggleNotificaciones) {
  toggleNotificaciones.addEventListener('change', function() {
    notificacionesHabilitadas = this.checked;
    console.log('Notificaciones', notificacionesHabilitadas ? 'activadas' : 'desactivadas');
  });
}

if (testSonido) {
  testSonido.addEventListener('click', function() {
    reproducirSonidoNotificacion();
    console.log('Sonido de prueba reproducido');
  });
}

// Event listener para botón de nuevo chat
var nuevoChat = document.getElementById('nuevo-chat');
if (nuevoChat) {
  nuevoChat.addEventListener('click', function() {
    if (confirm('¿Estás seguro de que quieres iniciar un nuevo chat? Se perderá todo el historial actual.')) {
      iniciarChatNuevo();
    }
  });
}

// Event listener para botón de cerrar chat
var cerrarChat = document.getElementById('cerrar-chat');
if (cerrarChat) {
  cerrarChat.addEventListener('click', function() {
    if (confirm('¿Estás seguro de que quieres cerrar el chat? Se perderá todo el historial y la conexión.')) {
      cerrarChatCompleto();
    }
  });
}

// Limpiar contador de mensajes cuando el usuario interactúa con el chat
var ventanaMensajes = document.getElementById('ventana-mensajes');
if (ventanaMensajes) {
  ventanaMensajes.addEventListener('click', function() {
    mensajesNoLeidos = 0;
    actualizarContadorMensajes();
    document.title = tituloOriginal; // Restaurar título original
  });
  
  // Detectar scroll manual del usuario
  ventanaMensajes.addEventListener('scroll', function() {
    // Limpiar contador cuando el usuario hace scroll hacia abajo
    if (detectarScrollManual()) {
      mensajesNoLeidos = 0;
      actualizarContadorMensajes();
      document.title = tituloOriginal;
    }
  });
}

// Limpiar contador cuando el usuario escribe
if (mensaje) {
  mensaje.addEventListener('focus', function() {
    mensajesNoLeidos = 0;
    actualizarContadorMensajes();
    document.title = tituloOriginal; // Restaurar título original
  });
}

// Eventos para limpiar historial al cerrar la aplicación
window.addEventListener('beforeunload', function() {
  // Solo limpiar si se está cerrando la aplicación completamente
  // (no al recargar la página)
  if (performance.navigation.type === 1) { // Tipo 1 = recarga
    console.log('Recargando página - manteniendo historial');
  } else {
    console.log('Cerrando aplicación - limpiando historial');
    limpiarHistorialCompleto();
  }
});

// Detectar si la página se está recargando vs cerrando
window.addEventListener('load', function() {
  // Verificar si hay historial previo al cargar
  var historialGuardado = localStorage.getItem('chat_historial');
  if (historialGuardado) {
    console.log('Historial encontrado - página recargada');
  } else {
    console.log('Sin historial - nueva sesión');
  }
});

// Limpiar historial cuando se cierra la pestaña/ventana
window.addEventListener('unload', function() {
  // Solo limpiar si no es una recarga
  if (performance.navigation.type !== 1) {
    limpiarHistorialCompleto();
  }
});

// Configurar event listeners iniciales del socket
configurarEventListenersSocket();
