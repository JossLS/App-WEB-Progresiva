// Configuración de Firebase
// IMPORTANTE: Reemplaza estos valores con los de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCk414XqzKLcKtxfi1tnY76QWMviTQpIIA",
  authDomain: "lia-bibliotecapp.firebaseapp.com",
  projectId: "lia-bibliotecapp",
  storageBucket: "lia-bibliotecapp.firebasestorage.app",
  messagingSenderId: "999689699712",
  appId: "1:999689699712:web:5157e5e12f5649a566c165",
  measurementId: "G-CX85083T2R"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias a los servicios de Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Configuraciones adicionales
db.settings({ timestampsInSnapshots: true });

console.log('Firebase inicializado correctamente');