// =========================================================================
// 1. IMPORTACIONES Y CONFIGURACIÓN INICIAL DE FIREBASE
// =========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Tu configuración de Firebase (La reemplazaremos con tus claves reales más adelante)
const firebaseConfig = {
  apiKey: "AIzaSyD2sOQFR8zrNlFIiNuo8kix_uT8EKDf2W0",
  authDomain: "berissotrabaja.firebaseapp.com",
  projectId: "berissotrabaja",
  storageBucket: "berissotrabaja.firebasestorage.app",
  messagingSenderId: "740111918801",
  appId: "1:740111918801:web:66e5d28d0e05f0e37c47f0"
};

// Inicializar la app y la base de datos
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variables de estado interno de la aplicación
let anunciosBase = [];

// =========================================================================
// 2. CAPTURA DE ELEMENTOS DEL DOM PARA EL FORMULARIO MODAL
// =========================================================================
const btnAbrirForm = document.getElementById("btnAbrirForm");
const modalFormulario = document.getElementById("modalFormulario");
const btnCerrarModal = document.getElementById("btnCerrarModal");
const formPublicar = document.getElementById("formPublicar");

// =========================================================================
// 3. LÓGICA DE APERTURA DEL MODAL
// =========================================================================
btnAbrirForm.addEventListener("click", () => {
    // Quitamos la clase que lo oculta para que aparezca en pantalla
    modalFormulario.classList.remove("modal-hidden");
    
    // Bloqueamos el scroll del fondo para que la experiencia en celular sea fluida
    document.body.style.overflow = "hidden"; 
});
// =========================================================================
// 4. LÓGICA DE CIERRE DEL MODAL
// =========================================================================
function cerrarModal() {
    // Agregamos la clase que oculta el modal
    modalFormulario.classList.add("modal-hidden");
    
    // Devolvemos el scroll normal a la pantalla trasera
    document.body.style.overflow = "auto";
}

// Cerrar al hacer clic en el botón "Cancelar"
btnCerrarModal.addEventListener("click", cerrarModal);

// Cerrar automáticamente si el vecino hace clic fuera de la caja blanca del formulario
modalFormulario.addEventListener("click", (e) => {
    if (e.target === modalFormulario) {
        cerrarModal();
    }
});

// =========================================================================
// 5. PROCESAMIENTO Y ENVÍO DEL FORMULARIO DE ALTA (A Firestore)
// =========================================================================
formPublicar.addEventListener("submit", async (e) => {
    e.preventDefault();

    const tipoAnuncio = document.getElementById("selectTipo").value; // "ofrecido", "gastronomia", "oferta"
    const rubroAnuncio = document.getElementById("selectRubro").value;
    const zonaAnuncio = document.getElementById("selectZona").value;
    const textoAnuncio = document.getElementById("textareaTexto").value.trim();
    let inputCelular = document.getElementById("inputCelular").value.trim();
    let inputEnlace = document.getElementById("inputEnlace").value.trim();

    // Limpieza estricta del celular (Dejamos solo números para la API de WhatsApp)
    let celularLimpio = inputCelular.replace(/\D/g, ''); 

    // Auto-corrección de formato para Argentina (549) y código local de Berisso (221)
    if (celularLimpio.startsWith("54") && !celularLimpio.startsWith("549")) {
        celularLimpio = celularLimpio.replace("54", "549");
    }
    if (celularLimpio.startsWith("221")) {
        celularLimpio = "549" + celularLimpio;
    }
    if (celularLimpio.length === 8 || celularLimpio.length === 10) {
        if (celularLimpio.startsWith("15")) { celularLimpio = celularLimpio.substring(2); }
        celularLimpio = "549221" + celularLimpio;
    }

    // Validación sutil para que el enlace extra de redes tenga el formato correcto
    if (inputEnlace && !/^https?:\/\//i.test(inputEnlace)) {
        inputEnlace = "https://" + inputEnlace;
    }

    // Cálculo automático de las fechas de expiración que definiste
    const fechaPublicacion = new Date();
    let fechaExpiracion = new Date();

    if (tipoAnuncio === "oferta") {
        fechaExpiracion.setDate(fechaPublicacion.getDate() + 14); // 2 semanas comunes para Pymes
    } else {
        fechaExpiracion.setDate(fechaPublicacion.getDate() + 30); // 1 mes común para Oficios/Comida
    }

    // Estructura del anuncio para la base de datos
    const nuevoAnuncio = {
        tipo: tipoAnuncio,
        rubro: rubroAnuncio,
        zona: zonaAnuncio,
        texto: textoAnuncio,
        whatsapp: celularLimpio,
        enlaceExtra: inputEnlace || "",
        fechaPublicacion: serverTimestamp(), // Marca de tiempo del servidor de Google
        fechaExpiracion: fechaExpiracion,
        destacado: false, // Nace gratis por defecto. Si te pagan los $10.000 semanales lo cambiás a true manual
        portada: false,   // Nace falso. Si te pagan los $25.000 de la portada principal lo pasás a true manual
        activo: true
    };

    try {
        // Inyección directa en la colección "anuncios" de Cloud Firestore
        await addDoc(collection(db, "anuncios"), nuevoAnuncio);
        alert("¡Tu anuncio fue publicado con éxito en Berisso Trabaja!");
        
        formPublicar.reset();
        cerrarModal();
        
        // Recargamos la aplicación para refrescar el tablón y que el vecino vea su mensaje al instante
        window.location.reload(); 
    } catch (error) {
        console.error("Error al guardar en Cloud Firestore: ", error);
        alert("Hubo un error técnico al publicar. Intentá de nuevo.");
    }
});
// =========================================================================
// 6. CAPTURA DE ELEMENTOS DEL DOM PARA EL BUSCADOR Y EL DIRECTORIO
// =========================================================================
const contenedorAnuncios = document.getElementById("contenedorAnuncios");
const inputBuscador = document.getElementById("inputBuscador");
const selectDirectorio = document.getElementById("selectDirectorio");

// =========================================================================
// 7. DESCARGA INICIAL DESDE CLOUD FIRESTORE (Se ejecuta una sola vez al cargar la web)
// =========================================================================
async function inicializarPortal() {
    try {
        contenedorAnuncios.innerHTML = `<p style="text-align:center; color:#888; padding: 40px 0; font-size:0.95rem;">Conectando con el tablón de Berisso...</p>`;
        
        const anunciosRef = collection(db, "anuncios");
        
        // REGLA COMERCIAL: Primero los destacados por rubro (true arriba), luego por fecha más nueva
        // Al mezclar dos ordenamientos distintos, Firebase te pedirá crear un Índice Compuesto (ver consola F12)
        const q = query(
            anunciosRef, 
            where("activo", "==", true), 
            orderBy("destacado", "desc"), 
            orderBy("fechaPublicacion", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        anunciosBase = [];
        
        querySnapshot.forEach((doc) => {
            anunciosBase.push({ id: doc.id, ...doc.data() });
        });

        // Arrancamos el renderizado con el buscador limpio (Muestra todo)
        filtrarYRenderizar("");
    } catch (error) {
        console.error("Error al conectar con Cloud Firestore:", error);
        contenedorAnuncios.innerHTML = `<p style="text-align:center; color:red; padding: 40px 0; font-size:0.95rem;">Hubo un error al cargar las publicaciones de la ciudad.</p>`;
    }
}
// =========================================================================
// 8. MOTOR DE FILTRADO INSTANTÁNEO E INYECCIÓN DE TARJETAS (Cero Burocracia)
// =========================================================================
function filtrarYRenderizar(terminoBusqueda) {
    const busqueda = terminoBusqueda.toLowerCase().trim();
    contenedorAnuncios.innerHTML = "";

    // A. EL GRAN DESTACADO DE PORTADA (Se muestra ÚNICAMENTE si el buscador y el selector están vacíos)
    if (busqueda === "") {
        const anuncioPortada = anunciosBase.find(anuncio => anuncio.portada === true);
        if (anuncioPortada) {
            inyectarTarjeta(anuncioPortada, true);
        }
    }

    // B. FILTRADO MULTI-CAMPO (Busca coincidencias excluyendo el anuncio fijo de la portada)
    const filtrados = anunciosBase.filter(anuncio => {
        const esDePortada = anuncio.portada === true;
        const coincideTexto = anuncio.texto.toLowerCase().includes(busqueda) || 
                              anuncio.rubro.toLowerCase().includes(busqueda) || 
                              anuncio.zona.toLowerCase().includes(busqueda);
        return !esDePortada && coincideTexto;
    });

    // C. RESPUESTA VISUAL SI EL RUBRO ELEGIDO ESTÁ VACÍO
    if (filtrados.length === 0 && busqueda !== "") {
        contenedorAnuncios.innerHTML = `
            <div style="text-align:center; color:#666666; padding: 60px 20px; font-size: 0.95rem; line-height: 1.6; border: 1px dashed #dddddd; margin-top: 20px;">
                <p>⚠️ <strong>No hay publicaciones activas en este rubro todavía.</strong></p>
                <p style="font-size:0.85rem; margin-top: 6px; color:#999999;">¡Sé el primero en aparecer acá arriba! Tocá el botón de abajo y publicá gratis.</p>
            </div>
        `;
        return;
    }

    // Inyectar los anuncios filtrados comunes o destacados por rubro si existen
    filtrados.forEach(anuncio => {
        inyectarTarjeta(anuncio, false);
    });
}


// Helper para procesar el HTML limpio con las divisiones cuidadas que armamos en el CSS
function inyectarTarjeta(anuncio, esPortadaPrincipal) {
    const item = document.createElement("article");
    
    // Asignar clases de CSS según el tipo de monetización y diseño
    if (esPortadaPrincipal) {
        item.className = "feed-item card-portada-principal animate-up";
    } else {
        item.className = `feed-item animate-up ${anuncio.destacado ? 'premium' : ''}`;
    }
    
    // Enlace nativo directo a la API de WhatsApp
    const urlWa = `https://wa.me/${anuncio.whatsapp}?text=Hola,%20vi%20tu%20anuncio%20en%20el%20portal%20Berisso%20Trabaja%20y%20quería%20hacerte%20una%20consulta.`;

    // Procesamiento inteligente de enlaces de redes sociales (Garantía Vecinal de Confianza)
    let enlaceExtraHtml = "";
    if (anuncio.enlaceExtra) {
        let icono = "🌐"; 
        let textoEnlace = "Ver Web / Portafolio";
        const linkLower = anuncio.enlaceExtra.toLowerCase();
        
        if (linkLower.includes("instagram.com") || linkLower.includes("ig.me")) { 
            icono = "📸"; 
            textoEnlace = "Ver Fotos / Perfil"; 
        }
        else if (linkLower.includes("facebook.com") || linkLower.includes("fb.watch")) { 
            icono = "👥"; 
            textoEnlace = "Ver Facebook / Perfil"; 
        }
        else if (linkLower.includes("youtube.com") || linkLower.includes("youtu.be")) { 
            icono = "🎵"; 
            textoEnlace = "Ver Video / Canal"; 
        }
        else if (linkLower.includes("github.com")) { 
            icono = "💻"; 
            textoEnlace = "Ver Código / GitHub"; 
        }
        
        enlaceExtraHtml = `<a href="${anuncio.enlaceExtra}" target="_blank" class="btn-link link-perfil-social">${icono} ${textoEnlace}</a>`;
    }

    // Etiquetas sutiles en bloque negro para los destacados pagos
    let badgeTexto = "";
    if (esPortadaPrincipal) {
        badgeTexto = `<span class="badge-featured">Anuncio Principal</span>`;
    } else if (anuncio.destacado) {
        badgeTexto = `<span class="badge-featured">Destacado</span>`;
    }

    item.innerHTML = `
        <div class="item-main">
            <p class="item-text">${anuncio.texto}</p>
        </div>
        <div class="item-meta">
            <div class="item-tags-wrapper">
                ${badgeTexto}
                <span class="item-tag">${anuncio.rubro}</span>
                <span class="item-location-tag">📍 ${anuncio.zona}</span>
            </div>
            <div class="item-actions">
                ${enlaceExtraHtml}
                <a href="${urlWa}" target="_blank" class="btn-link btn-whatsapp">💬 WhatsApp</a>
            </div>
        </div>
    `;
    contenedorAnuncios.appendChild(item);
}

// =========================================================================
// 9. LISTENERS EN TIEMPO REAL (Interacción de la Interfaz Limpia)
// =========================================================================

// Escuchar lo que escribe el vecino libremente en la barra gigante estilo Google
inputBuscador.addEventListener("input", () => {
    // Si el vecino tipea a mano, reseteamos el selector desplegable a la opción inicial
    selectDirectorio.value = "";
    filtrarYRenderizar(inputBuscador.value);
});

// ESCUCHADOR NUEVO: Controlar la selección por bloques del menú desplegable
selectDirectorio.addEventListener("change", (e) => {
    const valorSeleccionado = e.target.value;
    
    // Sincronizamos la barra de búsqueda estilo Google escribiendo el rubro elegido
    inputBuscador.value = valorSeleccionado;
    
    // Disparamos el motor de filtrado de Cloud Firestore al vuelo
    filtrarYRenderizar(valorSeleccionado);
});



// =========================================================================
// 10. ARRANQUE OFICIAL DE LA APLICACIÓN
// =========================================================================
inicializarPortal();

