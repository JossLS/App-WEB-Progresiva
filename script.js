// Variables globales
let usuarioActual = null;
let librosListener = null;
let notificationInterval = null;
let buzonStatsListener = null;

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
  inicializarApp();
});

function inicializarApp() {
  // Verificar estado de autenticación
  auth.onAuthStateChanged(function(user) {
    if (user) {
      usuarioActual = user;
      mostrarInterfazUsuario();
    } else {
      usuarioActual = null;
      mostrarInterfazLogin();
    }
  });

  // Event listeners para formularios
  document.getElementById('form-login').addEventListener('submit', manejarLogin);
  document.getElementById('form-register').addEventListener('submit', manejarRegistro);
  document.getElementById('form-subir').addEventListener('submit', manejarSubida);
  document.getElementById('form-buzon').addEventListener('submit', manejarBuzon);
}

// === FUNCIONES DE AUTENTICACIÓN ===

async function manejarLogin(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const email = formData.get('email');
  const password = formData.get('password');

  try {
    await auth.signInWithEmailAndPassword(email, password);
    mostrarMensaje('login-error', 'Bienvenido de vuelta!', 'success');
  } catch (error) {
    let mensaje = 'Error al iniciar sesión';
    if (error.code === 'auth/user-not-found') {
      mensaje = 'Usuario no encontrado';
    } else if (error.code === 'auth/wrong-password') {
      mensaje = 'Contraseña incorrecta';
    } else if (error.code === 'auth/invalid-email') {
      mensaje = 'Email inválido';
    }
    mostrarMensaje('login-error', mensaje, 'error');
  }
}

async function manejarRegistro(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const nombre = formData.get('nombre');
  const email = formData.get('email');
  const password = formData.get('password');

  if (password.length < 6) {
    mostrarMensaje('register-error', 'La contraseña debe tener al menos 6 caracteres', 'error');
    return;
  }

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    
    // Actualizar perfil del usuario
    await userCredential.user.updateProfile({
      displayName: nombre
    });

    // Guardar información adicional en Firestore
    await db.collection('usuarios').doc(userCredential.user.uid).set({
      nombre: nombre,
      email: email,
      fechaRegistro: firebase.firestore.FieldValue.serverTimestamp()
    });

    mostrarMensaje('register-error', 'Cuenta creada exitosamente!', 'success');
  } catch (error) {
    let mensaje = 'Error al crear la cuenta';
    if (error.code === 'auth/email-already-in-use') {
      mensaje = 'Este email ya está registrado';
    } else if (error.code === 'auth/invalid-email') {
      mensaje = 'Email inválido';
    } else if (error.code === 'auth/weak-password') {
      mensaje = 'La contraseña es muy débil';
    }
    mostrarMensaje('register-error', mensaje, 'error');
  }
}

async function cerrarSesion() {
  try {
    await auth.signOut();
    mostrarInterfazLogin();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

// === FUNCIONES DE INTERFAZ ===

function mostrarInterfazUsuario() {
  document.getElementById('login').classList.remove('active');
  document.getElementById('register').classList.remove('active');
  document.getElementById('main-nav').classList.remove('hidden');
  
  const nombreUsuario = usuarioActual.displayName || usuarioActual.email;
  document.getElementById('user-panel').innerHTML = `
    <span class="user-info">👤 ${nombreUsuario}</span>
    <button class="logout-btn" onclick="cerrarSesion()">Cerrar Sesión</button>
  `;
  
  // Mostrar panel de notificaciones siempre
  mostrarPanelNotificaciones();
  
  showSection('biblioteca');
  escucharLibros();
  escucharEstadisticasBuzon();
  iniciarNotificacionesPeriodicas();
}

function mostrarInterfazLogin() {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.getElementById('login').classList.add('active');
  document.getElementById('main-nav').classList.add('hidden');
  document.getElementById('user-panel').innerHTML = '';
  
  // Ocultar panel de notificaciones en login
  ocultarPanelNotificaciones();
  
  // Limpiar formularios
  document.getElementById('form-login').reset();
  document.getElementById('form-register').reset();
  
  // Detener listeners
  if (librosListener) {
    librosListener();
    librosListener = null;
  }
  if (buzonStatsListener) {
    buzonStatsListener();
    buzonStatsListener = null;
  }
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
}

function showLogin() {
  document.getElementById('register').classList.remove('active');
  document.getElementById('login').classList.add('active');
}

function showRegister() {
  document.getElementById('login').classList.remove('active');
  document.getElementById('register').classList.add('active');
}

function showSection(sectionName) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.getElementById(sectionName).classList.add('active');
  
  // Actualizar navegación activa
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(`nav-${sectionName}`).classList.add('active');
  
  if (sectionName === 'biblioteca') {
    cargarLibros();
  } else if (sectionName === 'buzon') {
    cargarEstadisticasBuzon();
  }
}

// === FUNCIONES DE GESTIÓN DE LIBROS ===

function escucharLibros() {
  if (librosListener) {
    librosListener();
  }
  
  librosListener = db.collection('libros')
    .orderBy('fechaSubida', 'desc')
    .onSnapshot(function(snapshot) {
      const libros = [];
      snapshot.forEach(function(doc) {
        libros.push({
          id: doc.id,
          ...doc.data()
        });
      });
      mostrarLibros(libros);
    }, function(error) {
      console.error('Error al cargar libros:', error);
      mostrarMensaje('lista-libros', 'Error al cargar los libros', 'error');
    });
}

function mostrarLibros(libros) {
  const lista = document.getElementById('lista-libros');
  lista.innerHTML = '';

  if (libros.length === 0) {
    lista.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">No hay libros disponibles</p>';
    return;
  }

  libros.forEach(libro => {
    const li = document.createElement('li');
    li.className = 'libro-item';
    
    const fechaFormateada = libro.fechaSubida ? 
      new Date(libro.fechaSubida.seconds * 1000).toLocaleDateString() : 
      'Fecha no disponible';
    
    li.innerHTML = `
      <h3>${libro.titulo}</h3>
      <p class="autor">por ${libro.autor}</p>
      ${libro.descripcion ? `<p class="descripcion">${libro.descripcion}</p>` : ''}
      <p class="fecha">📅 ${fechaFormateada}</p>
      <p class="subido-por">Subido por: ${libro.nombreUsuario}</p>
      ${libro.link ? `
  <button onclick="abrirLibro('${libro.id}', '${libro.link}')">🔗 Abrir Enlace</button>
` : `
  <button onclick="mostrarContenidoLibro('${libro.titulo}', \`${libro.contenido || 'Sin contenido'}\`)">📖 Leer</button>
`}

      <button onclick="abrirLibro('${libro.id}', '${libro.archivoURL}')">📖 Leer</button>
      ${libro.usuarioId === usuarioActual.uid ? 
        `<button class="delete-btn" onclick="eliminarLibro('${libro.id}', '${libro.archivoPath}')">🗑️ Eliminar</button>` : 
        ''}
    `;
    lista.appendChild(li);
  });
}

function cargarLibros() {
  if (!usuarioActual) return;
  
  document.getElementById('loading').classList.remove('hidden');
  // Los libros se cargan automáticamente a través del listener
  setTimeout(() => {
    document.getElementById('loading').classList.add('hidden');
  }, 1000);
}

async function manejarSubida(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const titulo = formData.get('titulo');
  const autor = formData.get('autor');
  const descripcion = formData.get('descripcion');
  const contenido = formData.get('contenido'); // nuevo campo
  const link = formData.get('link'); // opcional

  if (!titulo || !autor || (!contenido && !link)) {
    mostrarMensaje('subir-mensaje', 'Por favor completa título, autor y contenido o link', 'error');
    return;
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';

    await db.collection('libros').add({
      titulo,
      autor,
      descripcion,
      contenido: contenido || '',
      link: link || '',
      usuarioId: usuarioActual.uid,
      nombreUsuario: usuarioActual.displayName || usuarioActual.email,
      fechaSubida: firebase.firestore.FieldValue.serverTimestamp()
    });

    mostrarMensaje('subir-mensaje', '📚 Libro guardado exitosamente en la biblioteca', 'success');
    e.target.reset();

  } catch (error) {
    console.error('Error al guardar libro:', error);
    mostrarMensaje('subir-mensaje', '❌ Error al guardar el libro', 'error');
  } finally {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Subir';
  }
}

//async function manejarSubida(e) {
 // e.preventDefault();
  
  //const formData = new FormData(e.target);
  //const titulo = formData.get('titulo');
  //const autor = formData.get('autor');
  //const descripcion = formData.get('descripcion');
  //const archivo = formData.get('archivo');

  //if (!archivo) {
    //mostrarMensaje('subir-mensaje', 'Por favor selecciona un archivo', 'error');
    //return;
  //}

  //if (archivo.size > 10 * 1024 * 1024) { // 10MB máximo
    //mostrarMensaje('subir-mensaje', 'El archivo es demasiado grande (máximo 10MB)', 'error');
    //return;
  //}

  //try {
    // Deshabilitar botón de subida
    //const submitBtn = e.target.querySelector('button[type="submit"]');
    //submitBtn.disabled = true;
    //submitBtn.textContent = 'Subiendo...';
    
    // Mostrar barra de progreso
    //document.getElementById('upload-progress').classList.remove('hidden');
    
    // Crear referencia única para el archivo
    //const archivoPath = `libros/${usuarioActual.uid}/${Date.now()}_${archivo.name}`;
    //const storageRef = storage.ref(archivoPath);
    
    // Subir archivo con seguimiento de progreso
    //const uploadTask = storageRef.put(archivo);
    
    //uploadTask.on('state_changed', 
      //function(snapshot) {
        //const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        //document.getElementById('progress-fill').style.width = progress + '%';
        //document.getElementById('progress-text').textContent = `Subiendo: ${Math.round(progress)}%`;
      //},
      //function(error) {
       // console.error('Error al subir archivo:', error);
        //mostrarMensaje('subir-mensaje', 'Error al subir el archivo', 'error');
        //resetearFormularioSubida(e.target);
      //},
      //async function() {
        // Subida completada
       // try {
         // const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          
          // Guardar información del libro en Firestore
         // await db.collection('libros').add({
           // titulo: titulo,
            //autor: autor,
            //descripcion: descripcion,
            //archivoURL: downloadURL,
            //archivoPath: archivoPath,
            //usuarioId: usuarioActual.uid,
            //nombreUsuario: usuarioActual.displayName || usuarioActual.email,
            //fechaSubida: firebase.firestore.FieldValue.serverTimestamp()
          //});
          
          //mostrarMensaje('subir-mensaje', 'Libro subido exitosamente!', 'success');
          //e.target.reset();
          
        //} catch (error) {
          //console.error('Error al guardar información del libro:', error);
          //mostrarMensaje('subir-mensaje', 'Error al guardar la información del libro', 'error');
        //} finally {
          //resetearFormularioSubida(e.target);
        //}
      //}
    //);
    
  //} catch (error) {
    //console.error('Error al subir libro:', error);
    //mostrarMensaje('subir-mensaje', 'Error al subir el libro', 'error');
    //resetearFormularioSubida(e.target);
  //}
//}

function resetearFormularioSubida(form) {
  // Rehabilitar botón y ocultar progreso
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Subir';
  
  document.getElementById('upload-progress').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-text').textContent = 'Subiendo...';
}

function abrirLibro(id, url) {
  if (url) {
    window.open(url, '_blank');
  } else {
    alert('Error: No se pudo obtener la URL del archivo');
  }
}

async function eliminarLibro(id) {
  if (!confirm('¿Estás seguro de que quieres eliminar este libro?')) {
    return;
  }

  try {
    await db.collection('libros').doc(id).delete();
    mostrarMensaje('subir-mensaje', 'Libro eliminado exitosamente', 'success');
  } catch (error) {
    console.error('Error al eliminar libro:', error);
    mostrarMensaje('subir-mensaje', 'Error al eliminar el libro', 'error');
  }
}

// === FUNCIONES AUXILIARES ===

function mostrarMensaje(elementId, mensaje, tipo) {
  const elemento = document.getElementById(elementId);
  if (elemento) {
    elemento.textContent = mensaje;
    elemento.className = tipo;
    setTimeout(() => {
      elemento.textContent = '';
      elemento.className = '';
    }, 5000);
  }
}

// === FUNCIONES PARA LIBROS PRECARGADOS ===

async function cargarLibrosPrecargados() {
  const librosPrecargados = [
    {
      titulo: "El Principito",
      autor: "Antoine de Saint-Exupéry",
      descripcion: "Un clásico de la literatura infantil que nos enseña sobre la amistad y la imaginación",
      archivoURL: "https://www.planetadelibros.com/usuaris/libros/fotos/154/original/el-principito_9788408176053.jpg",
      usuarioId: "sistema",
      nombreUsuario: "Biblioteca",
      fechaSubida: firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      titulo: "Cuentos de la Selva",
      autor: "Horacio Quiroga",
      descripcion: "Fascinantes historias de animales de la selva americana",
      archivoURL: "https://example.com/cuentos-selva.pdf",
      usuarioId: "sistema",
      nombreUsuario: "Biblioteca",
      fechaSubida: firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      titulo: "Platero y Yo",
      autor: "Juan Ramón Jiménez",
      descripcion: "La entrañable historia de un hombre y su burro",
      archivoURL: "https://example.com/platero.pdf",
      usuarioId: "sistema",
      nombreUsuario: "Biblioteca",
      fechaSubida: firebase.firestore.FieldValue.serverTimestamp()
    }
  ];

  try {
    // Verificar si ya existen libros precargados
    const snapshot = await db.collection('libros').where('usuarioId', '==', 'sistema').get();
    
    if (snapshot.empty) {
      // Cargar libros precargados
      const batch = db.batch();
      
      librosPrecargados.forEach(libro => {
        const docRef = db.collection('libros').doc();
        batch.set(docRef, libro);
      });
      
      await batch.commit();
      console.log('Libros precargados añadidos');
    }
  } catch (error) {
    console.error('Error al cargar libros precargados:', error);
  }
}

// Llamar a la función cuando se inicialice la app
setTimeout(cargarLibrosPrecargados, 2000);

function mostrarContenidoLibro(titulo, contenido) {
  const ventana = window.open('', '_blank');
  ventana.document.write(`<h1>${titulo}</h1><pre style="white-space: pre-wrap; font-family: sans-serif;">${contenido}</pre>`);
}


// === FUNCIONES PARA BUZÓN DE SUGERENCIAS ===

async function manejarBuzon(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const datos = {
    nombre: formData.get('nombre'),
    correo: formData.get('correo'),
    telefono: formData.get('telefono'),
    tipo: formData.get('tipo'),
    mensaje: formData.get('mensaje'),
    usuarioId: usuarioActual ? usuarioActual.uid : 'anonimo',
    nombreUsuario: usuarioActual ? (usuarioActual.displayName || usuarioActual.email) : 'Usuario Anónimo',
    fechaEnvio: firebase.firestore.FieldValue.serverTimestamp(),
    estado: 'pendiente'
  };

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    await db.collection('buzon').add(datos);
    
    mostrarMensaje('buzon-mensaje', '¡Mensaje enviado exitosamente! Gracias por tu feedback.', 'success');
    e.target.reset();
    
    // Mostrar notificación
    mostrarNotificacionToast('📮 Tu mensaje ha sido enviado correctamente');
    
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    mostrarMensaje('buzon-mensaje', 'Error al enviar el mensaje. Inténtalo de nuevo.', 'error');
  } finally {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = '📤 Enviar Mensaje';
  }
}

function escucharEstadisticasBuzon() {
  if (buzonStatsListener) {
    buzonStatsListener();
  }
  
  buzonStatsListener = db.collection('buzon')
    .onSnapshot(function(snapshot) {
      const stats = {
        total: 0,
        sugerencias: 0,
        quejas: 0,
        felicitaciones: 0
      };
      
      snapshot.forEach(function(doc) {
        const data = doc.data();
        stats.total++;
        if (data.tipo === 'sugerencia') stats.sugerencias++;
        if (data.tipo === 'queja') stats.quejas++;
        if (data.tipo === 'felicitacion') stats.felicitaciones++;
      });
      
      actualizarEstadisticasBuzon(stats);
    });
}

function actualizarEstadisticasBuzon(stats) {
  document.getElementById('total-mensajes').textContent = stats.total;
  document.getElementById('total-sugerencias').textContent = stats.sugerencias;
  document.getElementById('total-quejas').textContent = stats.quejas;
  document.getElementById('total-felicitaciones').textContent = stats.felicitaciones;
}

function cargarEstadisticasBuzon() {
  // Las estadísticas se actualizan automáticamente con el listener
}

// === FUNCIONES DE NOTIFICACIONES ===

function mostrarPanelNotificaciones() {
  const panel = document.getElementById('notification-panel');
  panel.classList.remove('hidden');
  
  // Verificar estado de permisos y mostrar botón apropiado
  actualizarBotonNotificaciones();
}

function ocultarPanelNotificaciones() {
  const panel = document.getElementById('notification-panel');
  panel.classList.add('hidden');
}

function actualizarBotonNotificaciones() {
  const panel = document.getElementById('notification-panel');
  
  if (Notification.permission === 'granted') {
    panel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
        <span style="color: #4CAF50; font-weight: bold;">🔔 Notificaciones Activas</span>
        <button onclick="deshabilitarNotificaciones()" style="background: linear-gradient(45deg, #FF6B6B, #ee5a52); padding: 6px 12px; font-size: 12px; width: auto;">
          ❌ Desactivar
        </button>
      </div>
    `;
  } else if (Notification.permission === 'denied') {
    panel.innerHTML = `
      <div style="text-align: center;">
        <span style="color: #FF6B6B; font-size: 14px;">🔕 Notificaciones bloqueadas</span>
        <p style="font-size: 12px; margin: 5px 0; color: #666;">Habilítalas en la configuración del navegador</p>
      </div>
    `;
  } else {
    panel.innerHTML = `
      <button id="enable-notifications" onclick="solicitarPermisosNotificacion()" style="background: linear-gradient(45deg, #4CAF50, #45a049); padding: 8px 16px; font-size: 14px; width: auto;">
        🔔 Habilitar Notificaciones Educativas
      </button>
    `;
  }
}

async function solicitarPermisosNotificacion() {
  try {
    if (!('Notification' in window)) {
      mostrarNotificacionToast('❌ Este navegador no soporta notificaciones');
      return;
    }

    if (Notification.permission === 'granted') {
      mostrarNotificacionToast('✅ Las notificaciones ya están habilitadas');
      actualizarBotonNotificaciones();
      return;
    }

    // Mostrar mensaje explicativo antes de solicitar permisos
    mostrarNotificacionToast('📚 Te enviaremos tips educativos cada 20 segundos');
    
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      mostrarNotificacionToast('🎉 ¡Notificaciones habilitadas! Recibirás tips educativos');
      actualizarBotonNotificaciones();
      iniciarNotificacionesPeriodicas();
      
      // Enviar primera notificación de bienvenida
      setTimeout(() => {
        new Notification('🎓 LIA BibliotecApp', {
          body: '¡Bienvenido! Ahora recibirás consejos educativos cada 20 segundos',
          icon: 'icons/icon-192.png',
          tag: 'welcome'
        });
      }, 1000);
      
    } else if (permission === 'denied') {
      mostrarNotificacionToast('❌ Permisos de notificación denegados');
      actualizarBotonNotificaciones();
    } else {
      mostrarNotificacionToast('⚠️ Permisos de notificación no concedidos');
    }
  } catch (error) {
    console.error('Error al solicitar permisos:', error);
    mostrarNotificacionToast('❌ Error al habilitar notificaciones');
  }
}

function deshabilitarNotificaciones() {
  // Detener el intervalo de notificaciones
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
  
  mostrarNotificacionToast('🔕 Notificaciones desactivadas temporalmente');
  
  // Actualizar botón para mostrar opción de reactivar
  const panel = document.getElementById('notification-panel');
  panel.innerHTML = `
    <button onclick="reactivarNotificaciones()" style="background: linear-gradient(45deg, #4CAF50, #45a049); padding: 8px 16px; font-size: 14px; width: auto;">
      🔔 Reactivar Notificaciones
    </button>
  `;
}

function reactivarNotificaciones() {
  if (Notification.permission === 'granted') {
    iniciarNotificacionesPeriodicas();
    actualizarBotonNotificaciones();
    mostrarNotificacionToast('🔔 Notificaciones reactivadas');
  } else {
    solicitarPermisosNotificacion();
  }
}

function iniciarNotificacionesPeriodicas() {
  // Limpiar intervalo anterior si existe
  if (notificationInterval) {
    clearInterval(notificationInterval);
  }
  
  // Verificar permisos antes de iniciar
  if (Notification.permission !== 'granted') {
    console.log('Permisos de notificación no concedidos');
    return;
  }
  
  console.log('Iniciando notificaciones periódicas cada 20 segundos');
  
  // Enviar primera notificación inmediatamente
  setTimeout(() => {
    enviarNotificacionInteresante();
  }, 2000);
  
  // Enviar notificación cada 20 segundos
  notificationInterval = setInterval(() => {
    enviarNotificacionInteresante();
  }, 10000); // 10 segundos
}

function enviarNotificacionInteresante() {
  if (Notification.permission !== 'granted') return;
  
  const mensajesInteresantes = [
    '📚 ¿Sabías que leer 20 minutos al día puede mejorar tu vocabulario significativamente?',
    '🧠 La lectura estimula la conectividad neuronal y mejora la función cerebral',
    '🌟 Los niños que leen regularmente desarrollan mejor empatía y habilidades sociales',
    '📖 Leer antes de dormir puede mejorar la calidad del sueño',
    '🎯 La lectura digital permite acceso instantáneo a miles de libros',
    '💡 Los libros infantiles ayudan a desarrollar la creatividad y imaginación',
    '🏆 Cada libro que lees te acerca más a tus metas educativas',
    '🌍 La educación digital democratiza el acceso a la información',
    '📚 BibliotecApp ya tiene más libros disponibles para explorar',
    '🚀 ¡Tu próxima gran aventura literaria te está esperando!',
    '🌈 Los cuentos infantiles enseñan valores importantes de forma divertida',
    '🎨 La ilustración en libros infantiles estimula el desarrollo visual'
  ];
  
  const mensajeAleatorio = mensajesInteresantes[Math.floor(Math.random() * mensajesInteresantes.length)];
  
  const notification = new Notification('LIA BibliotecApp', {
    body: mensajeAleatorio,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-72.png',
    tag: 'bibliotecapp-tip',
    requireInteraction: false,
    silent: false
  });
  
  // También mostrar toast en la app
  mostrarNotificacionToast(mensajeAleatorio);
  
  // Auto cerrar después de 5 segundos
  setTimeout(() => {
    notification.close();
  }, 5000);
  
  // Manejar clic en notificación
  notification.onclick = function() {
    window.focus();
    this.close();
  };
}

function mostrarNotificacionToast(mensaje) {
  // Remover toast anterior si existe
  const existingToast = document.querySelector('.notification-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Crear nuevo toast
  const toast = document.createElement('div');
  toast.className = 'notification-toast';
  toast.textContent = mensaje;
  
  document.body.appendChild(toast);
  
  // Auto remover después de 4 segundos
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('hide');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }
  }, 4000);
}