// Variables globales
let usuarioActual = null;
let librosListener = null;

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
  
  showSection('biblioteca');
  escucharLibros();
}

function mostrarInterfazLogin() {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.getElementById('login').classList.add('active');
  document.getElementById('main-nav').classList.add('hidden');
  document.getElementById('user-panel').innerHTML = '';
  
  // Limpiar formularios
  document.getElementById('form-login').reset();
  document.getElementById('form-register').reset();
  
  // Detener listener de libros
  if (librosListener) {
    librosListener();
    librosListener = null;
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
  const archivo = formData.get('archivo');

  if (!archivo) {
    mostrarMensaje('subir-mensaje', 'Por favor selecciona un archivo', 'error');
    return;
  }

  if (archivo.size > 10 * 1024 * 1024) { // 10MB máximo
    mostrarMensaje('subir-mensaje', 'El archivo es demasiado grande (máximo 10MB)', 'error');
    return;
  }

  try {
    // Deshabilitar botón de subida
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Subiendo...';
    
    // Mostrar barra de progreso
    document.getElementById('upload-progress').classList.remove('hidden');
    
    // Crear referencia única para el archivo
    const archivoPath = `libros/${usuarioActual.uid}/${Date.now()}_${archivo.name}`;
    const storageRef = storage.ref(archivoPath);
    
    // Subir archivo con seguimiento de progreso
    const uploadTask = storageRef.put(archivo);
    
    uploadTask.on('state_changed', 
      function(snapshot) {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        document.getElementById('progress-fill').style.width = progress + '%';
        document.getElementById('progress-text').textContent = `Subiendo: ${Math.round(progress)}%`;
      },
      function(error) {
        console.error('Error al subir archivo:', error);
        mostrarMensaje('subir-mensaje', 'Error al subir el archivo', 'error');
        resetearFormularioSubida(e.target);
      },
      async function() {
        // Subida completada
        try {
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          
          // Guardar información del libro en Firestore
          await db.collection('libros').add({
            titulo: titulo,
            autor: autor,
            descripcion: descripcion,
            archivoURL: downloadURL,
            archivoPath: archivoPath,
            usuarioId: usuarioActual.uid,
            nombreUsuario: usuarioActual.displayName || usuarioActual.email,
            fechaSubida: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          mostrarMensaje('subir-mensaje', 'Libro subido exitosamente!', 'success');
          e.target.reset();
          
        } catch (error) {
          console.error('Error al guardar información del libro:', error);
          mostrarMensaje('subir-mensaje', 'Error al guardar la información del libro', 'error');
        } finally {
          resetearFormularioSubida(e.target);
        }
      }
    );
    
  } catch (error) {
    console.error('Error en el proceso de subida:', error);
    mostrarMensaje('subir-mensaje', 'Error al procesar la subida', 'error');
    resetearFormularioSubida(e.target);
  }
}

function resetearFormularioSubida(form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Subir';
  document.getElementById('upload-progress').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0%';
}

async function eliminarLibro(libroId, archivoPath) {
  if (!confirm('¿Estás seguro de que quieres eliminar este libro?')) {
    return;
  }
  
  try {
    // Eliminar archivo del Storage
    if (archivoPath) {
      await storage.ref(archivoPath).delete();
    }
    
    // Eliminar documento de Firestore
    await db.collection('libros').doc(libroId).delete();
    
    mostrarMensaje('subir-mensaje', 'Libro eliminado exitosamente', 'success');
  } catch (error) {
    console.error('Error al eliminar libro:', error);
    mostrarMensaje('subir-mensaje', 'Error al eliminar el libro', 'error');
  }
}

function abrirLibro(libroId, archivoURL) {
  if (archivoURL) {
    // Abrir PDF en nueva pestaña
    window.open(archivoURL, '_blank');
    
    // Opcional: Registrar la lectura
    registrarLectura(libroId);
  } else {
    alert('El archivo no está disponible');
  }
}

async function registrarLectura(libroId) {
  try {
    await db.collection('lecturas').add({
      libroId: libroId,
      usuarioId: usuarioActual.uid,
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error al registrar lectura:', error);
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

// === FUNCIONES PARA LIBROS PRECARGADOS (OPCIONAL) ===

async function cargarLibrosPrecargados() {
  // Solo ejecutar una vez, verificar si ya existen libros
  const snapshot = await db.collection('libros').limit(1).get();
  if (!snapshot.empty) {
    return; // Ya hay libros, no cargar los precargados
  }
  
  const librosPrecargados = [
    {
      titulo: "El Principito",
      autor: "Antoine de Saint-Exupéry",
      descripcion: "Un clásico de la literatura infantil sobre un pequeño príncipe y sus aventuras.",
      nombreUsuario: "Sistema",
      usuarioId: "sistema",
      fechaSubida: firebase.firestore.FieldValue.serverTimestamp(),
      archivoURL: "https://drive.google.com/file/d/0B2KsqXqIxPBESzRZS2EzRFMyVEU/preview?resourcekey=0-KBMLcfAT9vLuj4uJ8-s6sQ", // En una implementación real, aquí iría la URL del PDF
      archivoPath: ""
    },
    {
      titulo: "Cuentos de la Selva",
      autor: "Horacio Quiroga",
      descripcion: "Colección de cuentos que narran las aventuras de los animales de la selva.",
      nombreUsuario: "Sistema",
      usuarioId: "sistema",
      fechaSubida: firebase.firestore.FieldValue.serverTimestamp(),
      archivoURL: "#",
      archivoPath: ""
    }
  ];
  
  try {
    for (const libro of librosPrecargados) {
      await db.collection('libros').add(libro);
    }
    console.log('Libros precargados añadidos');
  } catch (error) {
    console.error('Error al cargar libros precargados:', error);
  }
}

// Llamar a esta función solo una vez para precargar libros de ejemplo
// cargarLibrosPrecargados();