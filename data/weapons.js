// Base de datos de Armas y Equipamiento de Gantz
window.GANTZ_DEFAULT_WEAPONS = [
  {
    id: 'wpn-xgun',
    name: 'X-Gun (Pistola X)',
    category: 'Armamento Básico',
    type: 'Pistola de Energía',
    icon: '🔫',
    image: '',
    range: 'Medio (30m)',
    sound: 'xgun',
    description: 'Arma estándar con 4 gatillos y cañón giratorio cilíndrico. Dispara una onda de compresión invisible.',
    mechanics: 'Disparo invisible con retardo de 3 segundos. Hace explotar al objetivo de adentro hacia afuera.',
    quote: 'Aprieta los dos gatillos a la vez y espera tres segundos.'
  },
  {
    id: 'wpn-xshotgun',
    name: 'X-Shotgun (Rifle Francotirador X)',
    category: 'Armamento Pesado',
    type: 'Rifle de Precisión',
    icon: '🎯',
    image: '',
    range: 'Largo (1 km)',
    sound: 'xgun',
    description: 'Versión rifle de la X-Gun con cañón extendido y mira holográfica de bloqueo automático.',
    mechanics: 'Doble de daño que la X-Gun y rango kilométrico. Puede fijar múltiples objetivos a la vez.',
    quote: 'Para objetivos aéreos o monstruos de gran escala.'
  },
  {
    id: 'wpn-ygun',
    name: 'Y-Gun (Pistola de Captura Y)',
    category: 'Armamento Táctico',
    type: 'Lanzador de Anclajes',
    icon: '🕸️',
    image: '',
    range: 'Medio (25m)',
    sound: 'ygun',
    description: 'Pistola de tres cañones triangulares que dispara cables de aleación de alta resistencia con tres anclajes.',
    mechanics: 'Inmoviliza al alien y al presionar el gatillo inferior lo teletransporta hacia arriba para ser eliminado en la atmósfera.',
    quote: 'Enredo y envío directo al más allá.'
  },
  {
    id: 'wpn-suit',
    name: 'Traje Reforzado de Gantz (G-Suit)',
    category: 'Equipamiento Vital',
    type: 'Bio-Armadura de Nanofibras',
    icon: '🥋',
    image: '',
    range: 'Personal',
    sound: 'suit',
    description: 'Traje de elastano negro con cápsulas de líquido azul conectadas a los músculos del usuario.',
    mechanics: 'Otorga fuerza sobrehumana (levantar autos), saltar edificios y absorbe daño letal hasta que las cápsulas revientan y gotean líquido azul.',
    quote: 'Si el líquido azul se agota, eres carne picada.'
  },
  {
    id: 'wpn-sword',
    name: 'Gantz Sword (Katana Extensible)',
    category: 'Arma Cuerpo a Cuerpo',
    type: 'Espada Retráctil',
    icon: '🗡️',
    image: '',
    range: 'Cuerpo a Cuerpo / Extensible (30m)',
    sound: 'sword',
    description: 'Espada de aleación negra con empuñadura ergonómica. La hoja puede extenderse decenas de metros en un parpadeo.',
    mechanics: 'Corta aleaciones alienígenas densas. Al extenderse en el momento del tajo atraviesa armaduras y múltiples enemigos en fila.',
    quote: 'Rebana cualquier cosa sin perder el filo.'
  },
  {
    id: 'wpn-bike',
    name: 'Gantz Bike (Monociclo Flotante)',
    category: 'Vehículo Táctico',
    type: 'Monorrueda de Combate',
    icon: '🏍️',
    image: '',
    range: 'Vehicular',
    sound: 'suit',
    description: 'Vehículo monorrueda con tecnología antigravitatoria parcial, asiento para piloto y copiloto, y cañón frontal.',
    mechanics: 'Velocidad de hasta 250 km/h, maniobras verticales en edificios y disparo de apoyo frontal.',
    quote: 'Para llegar a la zona de caza antes que nadie.'
  }
];
