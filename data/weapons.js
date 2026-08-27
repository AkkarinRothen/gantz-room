// Base de datos de Armas y Equipamiento de Gantz (Iniciales de la Esfera vs Recompensas de 100 Pts)
window.GANTZ_DEFAULT_WEAPONS = [
  // ==================== 1. EQUIPAMIENTO INICIAL DE LA ESFERA ====================
  {
    id: 'wpn-suit-box',
    name: 'Cajas Cilíndricas con Traje (G-Suit)',
    category: 'Equipamiento Inicial de la Esfera',
    type: 'Bio-Armadura Personalizada',
    icon: '📦',
    image: 'assets/webp/weapons/traje_biomecanico_reforzado_en_esfera_abierta.webp',
    range: 'Personal',
    sound: 'suit',
    isRevealed: false,
    quote: 'Hay una caja negra con el nombre de cada uno de vosotros escrita en ella.',
    secretMechanics: 'Otorga fuerza sobrehumana para saltar edificios y levantar vehículos. Absorbe daño letal hasta que las cápsulas revientan y gotean líquido azul.',
    damageInfo: 'Fuerza × 10 / Absorción de daño total hasta vaciado de líquido'
  },
  {
    id: 'wpn-xgun',
    name: 'Pistola X (X-Gun)',
    category: 'Armamento Básico de la Esfera',
    type: 'Pistola de Compresión',
    icon: '🔫',
    image: 'assets/webp/weapons/civil_y_pistola_alienigena_en_retroceso.webp',
    range: 'Medio (30m)',
    sound: 'xgun',
    isRevealed: false,
    quote: 'Un cacharro negro con cuatro gatillos y cañón giratorio. No parece disparar nada al apretar uno.',
    secretMechanics: 'Debes apretar los dos gatillos superiores e inferiores simultáneamente. Dispara una onda de compresión invisible con un retardo de 3 segundos antes de hacer explotar al objetivo de adentro hacia afuera.',
    damageInfo: '2d10 Daño de Compresión Interna (Retardo 3 seg)'
  },
  {
    id: 'wpn-ygun',
    name: 'Pistola Y (Y-Gun)',
    category: 'Armamento Táctico de la Esfera',
    type: 'Lanzador de Anclajes',
    icon: '🕸️',
    image: 'assets/webp/weapons/cuatro_caminos_ante_la_esfera_negra.webp',
    range: 'Medio (25m)',
    sound: 'ygun',
    isRevealed: false,
    quote: 'Pistola con tres bocas de cañón dispuestas en triángulo y un gatillo inferior.',
    secretMechanics: 'Dispara tres anclajes con cables de aleación indestructible que envuelven al alien. Al presionar el gatillo secundario, activa un haz electromagnético que teletransporta al alien a la atmósfera para su eliminación.',
    damageInfo: 'Inmovilización Total + Teletransporte de Eliminación'
  },
  {
    id: 'wpn-radar',
    name: 'Controlador / Radar de Gantz',
    category: 'Dispositivo Táctico de la Esfera',
    type: 'HUD Holográfico',
    icon: '🧭',
    image: 'assets/webp/weapons/radar_alienigena_en_la_oscuridad.webp',
    range: 'Área de Misión (1 km)',
    sound: 'click',
    isRevealed: false,
    quote: 'Un dispositivo portátil con una pantalla circular oscura y botones laterales.',
    secretMechanics: 'Muestra el mapa del área de la misión, los límites del perímetro de caza, la ubicación en tiempo real de los objetivos alienígenas (flechas rojas) y el tiempo límite antes de que explote la cabeza del novato.',
    damageInfo: 'Rastreo y Detección de Aliens / Advertencia de Perímetro'
  },
  {
    id: 'wpn-xshotgun',
    name: 'Rifle X (X-Shotgun)',
    category: 'Armamento Pesado de la Esfera',
    type: 'Rifle de Francotirador X',
    icon: '🎯',
    image: 'assets/webp/weapons/cazador_biomecanico_en_vuelo_sobre_tokio.webp',
    range: 'Largo (1 km)',
    sound: 'xgun',
    isRevealed: false,
    quote: 'Rifle de cañón largo con visor holográfico desplegable ubicado en la parte superior del rack.',
    secretMechanics: 'Versión de francotirador de la X-Gun. Posee mira de fijación automática multiblanco y doble potencia de impacto a distancias kilométricas con retardo de 3 segundos.',
    damageInfo: '4d10 Daño de Compresión / Bloqueo de hasta 3 objetivos'
  },

  // ==================== 2. RECOMPENSAS DEL MENÚ DE 100 PUNTOS ====================
  {
    id: 'wpn-sword',
    name: 'Espada de Gantz (Katana Extensible)',
    category: 'Recompensa del Menú de 100 Puntos',
    type: 'Hoja Retráctil',
    icon: '🗡️',
    image: 'assets/webp/weapons/katana_alienigena_telescopica_en_caja_abierta.webp',
    range: 'Cuerpo a Cuerpo / Extensible (30m)',
    sound: 'sword',
    isRevealed: false,
    quote: 'Katana de aleación negra con empuñadura ergonómica.',
    secretMechanics: 'Hoja retráctil capaz de extenderse instantáneamente decenas de metros al lanzar un tajo. Corta metales y pieles alienígenas densas sin perder el filo.',
    damageInfo: '3d8 Daño Cortante / Alcance extensible de 30 metros'
  },
  {
    id: 'wpn-bike',
    name: 'Monociclo Flotante (Gantz Bike)',
    category: 'Recompensa del Menú de 100 Puntos',
    type: 'Vehículo de Combate',
    icon: '🏍️',
    image: 'assets/webp/weapons/motocicleta_alienigena_junto_a_la_esfera_negra.webp',
    range: 'Vehicular',
    sound: 'suit',
    isRevealed: false,
    quote: 'Monorrueda de aleación negra con asiento para conductor y copiloto en la parte trasera.',
    secretMechanics: 'Alcanza 250 km/h con estabilizadores giroscópicos. Puede trepar verticalmente paredes de rascacielos y cuenta con cañón frontal de apoyo.',
    damageInfo: 'Velocidad 250 km/h / Movimiento Vertical en Edificios'
  },
  {
    id: 'wpn-zgun',
    name: 'Cañón Gravitatorio (Z-Gun)',
    category: 'Recompensa del Menú de 100 Puntos',
    type: 'Arma Pesada de Gravedad',
    icon: '⚡',
    image: 'assets/webp/weapons/canon_gravitatorio__impacto_vertical_nocturno.webp',
    range: 'Medio-Largo (80m)',
    sound: 'xgun',
    isRevealed: false,
    quote: 'Arma pesada con dos cañones masivos superpuestos.',
    secretMechanics: 'Dispara una columna invisible de gravedad aplastante sobre el área seleccionada, estampando y pulverizando a los monstruos contra el suelo al instante.',
    damageInfo: '6d10 Daño Gravitatorio / Aplastamiento de Área'
  }
];
