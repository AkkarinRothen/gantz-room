/**
 * GANTZ ROOM - SCORING EVALUATOR & MANGA ROAST ENGINE
 * 
 * Generates authentic, cynical Gantz Sphere evaluations and roasts
 * based on hunter score tiers, survival status, and kills.
 */

(function() {
  'use strict';

  const GANTZ_ROAST_POOLS = {
    // 0 Points (Insults & Cowardice)
    zero: [
      "{name}: Cero puntos. Vaya inútil. Solo has servido de cebo esta noche.",
      "{name}: Cero puntos. Menuda basura. Deberías agradecer que sigues con vida.",
      "{name}: Cero puntos. Ni para estorbar sirves.",
      "{name}: Cero puntos. Un cero a la izquierda. La próxima vez quédate en casa llorando.",
      "{name}: Cero puntos. ¿Acaso has estado escondido debajo de un coche toda la noche?",
      "{name}: Cero puntos. Patético. Tu vida sigue sin valer absolutamente nada."
    ],

    // 1 to 10 Points (Novice / Lucky Survival)
    low: [
      "{name}: {points} puntos. Has rascado algo de suerte. Por lo menos no has muerto como un perro.",
      "{name}: {points} puntos. Poca cosa, pero al menos has manchado el traje de sangre alienígena.",
      "{name}: {points} puntos. Has matado una porquería, pero algo es algo.",
      "{name}: {points} puntos. No te emociones, sigues siendo un novato de mierda.",
      "{name}: {points} puntos. Apenas suficiente para no darme vergüenza ajena."
    ],

    // 11 to 49 Points (Competent Hunter / Combatant)
    mid: [
      "{name}: {points} puntos. Vaya sorpresa, parece que hoy no te has hecho pis encima. Buen trabajo.",
      "{name}: {points} puntos. No está mal para un aficionado. Sigues siendo útil para la próxima cacería.",
      "{name}: {points} puntos. Buen espectáculo de vísceras. Te estás ganando el derecho a respirar.",
      "{name}: {points} puntos. Bastante decente. Los alienígenas han probado tu medicina.",
      "{name}: {points} puntos. Parece que por fin has aprendido a apretar los gatillos."
    ],

    // 50 to 99 Points (Elite / Bloodbath)
    high: [
      "{name}: {points} puntos. Impresionante carnicería. Eres un auténtico monstruo.",
      "{name}: {points} puntos. El amo de la noche. Casi alcanzas la libertad.",
      "{name}: {points} puntos. Una verdadera masacre. Así es como se caza en mi juego.",
      "{name}: {points} puntos. Estás a un paso de los cien puntos. No te mueras antes."
    ],

    // 100+ Points (Freedom / Weapon / Resurrection)
    hundred: [
      "¡¡CIEN PUNTOS PARA {name}!! Impresionante. Elige tu premio de la esfera antes de que me arrepienta.",
      "¡¡{name} HA ALCANZADO LOS CIEN PUNTOS!! Menuda máquina de matar. Reclama tu recompensa.",
      "¡¡CIEN PUNTOS!! {name}, has ganado el menú especial. Elige entre la libertad, un arma pesada o revivir a un cadáver."
    ],

    // Dead Hunters (Cynical Eulogy)
    dead: [
      "{name}: {points} puntos. Muerto como una rata. Tu vida era patética y tu muerte también.",
      "{name}: {points} puntos. Fin del juego para ti. Tu cuerpo se queda pudriéndose en el asfalto.",
      "{name}: {points} puntos. Te advertí que no te confiaras. Una baja más en la lista.",
      "{name}: {points} puntos. Demasiado lento. El alien te ha despedazado sin piedad."
    ]
  };

  class ScoringEvaluator {
    // Generate an authentic Gantz roast based on hunter's state
    generateRoast(hunter) {
      if (!hunter) return "Un cazador sin nombre ni gloria.";
      const name = hunter.name || "Cazador";
      const pts = parseInt(hunter.points, 10) || 0;
      const isDead = hunter.isDead || hunter.status === 'dead';

      let pool;
      if (isDead) {
        pool = GANTZ_ROAST_POOLS.dead;
      } else if (pts >= 100) {
        pool = GANTZ_ROAST_POOLS.hundred;
      } else if (pts >= 50) {
        pool = GANTZ_ROAST_POOLS.high;
      } else if (pts >= 11) {
        pool = GANTZ_ROAST_POOLS.mid;
      } else if (pts >= 1) {
        pool = GANTZ_ROAST_POOLS.low;
      } else {
        pool = GANTZ_ROAST_POOLS.zero;
      }

      const template = pool[Math.floor(Math.random() * pool.length)];
      return template.replace(/\{name\}/g, name).replace(/\{points\}/g, pts);
    }

    // Get all available roast templates for a score tier
    getRoastOptions(hunter) {
      if (!hunter) return [];
      const name = hunter.name || "Cazador";
      const pts = parseInt(hunter.points, 10) || 0;
      const isDead = hunter.isDead || hunter.status === 'dead';

      let pool = isDead ? GANTZ_ROAST_POOLS.dead :
                 pts >= 100 ? GANTZ_ROAST_POOLS.hundred :
                 pts >= 50 ? GANTZ_ROAST_POOLS.high :
                 pts >= 11 ? GANTZ_ROAST_POOLS.mid :
                 pts >= 1 ? GANTZ_ROAST_POOLS.low :
                 GANTZ_ROAST_POOLS.zero;

      return pool.map(t => t.replace(/\{name\}/g, name).replace(/\{points\}/g, pts));
    }
  }

  window.GantzScoringEvaluator = new ScoringEvaluator();
})();
