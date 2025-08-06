// Firebase Messaging Service Worker
// Este archivo debe estar en la raíz del proyecto

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuración de Firebase (debe coincidir con la del archivo principal)
const firebaseConfig = {
 apiKey: "AIzaSyCk414XqzKLcKtxfi1tnY76QWMviTQpIIA",
  authDomain: "lia-bibliotecapp.firebaseapp.com",
  projectId: "lia-bibliotecapp",
  storageBucket: "lia-bibliotecapp.firebasestorage.app",
  messagingSenderId: "999689699712",
  appId: "1:999689699712:web:5157e5e12f5649a566c165",
  measurementId: "G-CX85083T2R"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Manejar mensajes en segundo plano
messaging.onBackgroundMessage(function(payload) {
  console.log('Mensaje recibido en segundo plano:', payload);
  
  const notificationTitle = payload.notification.title || 'LIA BibliotecApp';
  const notificationOptions = {
    body: payload.notification.body || 'Tienes una nueva notificación',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: 'bibliotecapp-notification',
    data: payload.data,
    actions: [
      {
        action: 'open',
        title: 'Abrir App'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', function(event) {
  console.log('Clic en notificación:', event);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    // Abrir o enfocar la app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(function(clientList) {
          // Si hay una ventana abierta, enfocarla
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          // Si no hay ventana abierta, abrir una nueva
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});