// In-app rules copy — mirrors docs/plans/10_variantes_billard/ressources/complete-rulebook.md

import type { GameConfig } from "./types";
import { CAROM_MODES, getVariant, type CaromMode } from "./variants";

export interface RulesSection {
  title: string;
  body: string;
}

export function rulesForConfig(config: GameConfig | undefined): {
  heading: string;
  sections: RulesSection[];
} {
  const v = getVariant(config?.variantId);
  const caromMode: CaromMode = config?.caromMode ?? "LIBRE";

  switch (v.id) {
    case "FR_CAROM": {
      const modeLabel = CAROM_MODES.find((m) => m.id === caromMode)?.label ?? "Partie libre";
      const cushionBit =
        caromMode === "THREE_CUSHION"
          ? "La bille de jeu doit toucher au moins **3 bandes** avant de contacter la 2ᵉ bille."
          : caromMode === "ONE_CUSHION"
            ? "La bille de jeu doit toucher au moins **1 bande** avant de contacter la 2ᵉ bille."
            : "Aucune contrainte de bande (partie libre).";
      return {
        heading: `Billard français — ${modeLabel}`,
        sections: [
          {
            title: "Matériel",
            body: "Table **sans trous**. 3 billes : blanche (Team 1), jaune (Team 2), rouge (objet).",
          },
          {
            title: "But",
            body: `Premier camp à atteindre la distance (${v.winTarget} points) par caramboles valides.`,
          },
          {
            title: "Carambole",
            body: `Un point = la bille de jeu touche **les deux autres** dans le même coup. ${cushionBit}`,
          },
          {
            title: "Tour",
            body: "Tant qu'un point est marqué, le tireur reste à la table. Sinon le tour passe ; l'adversaire joue de la position courante.",
          },
          {
            title: "Fautes",
            body: "Aucune bille / une seule bille touchée, bandes insuffisantes (selon le mode), bille sortie de table (remise sur son spot d'origine). Pénalité : perte de tour, pas de point.",
          },
        ],
      };
    }
    case "EN_BLACKBALL":
      return {
        heading: "Blackball (anglais)",
        sections: [
          {
            title: "But",
            body: "Empocher les 7 billes de son groupe (rouges ou jaunes), puis la **noire** sans faute.",
          },
          {
            title: "Casse",
            body: "Valide si ≥1 bille objet empochée **ou** ≥4 objets à la bande. Table **ouverte** après la casse ; groupes assignés à la 1ʳᵉ bille légale empochée **après** la casse.",
          },
          {
            title: "Fautes",
            body: "Scratch, mauvaise première bille, pas de bande si rien n'est empoché… → adversaire : **2 free shots** + free ball + blanche dans le D (kitchen).",
          },
          {
            title: "Défaite immédiate",
            body: "Noire trop tôt, noire + faute, noire hors table.",
          },
        ],
      };
    case "US_NINE":
      return {
        heading: "Jeu de la 9",
        sections: [
          {
            title: "Règle",
            body: "Toujours toucher d'abord la bille **la plus basse**. Victoire = pot légal de la **9** (combo OK), y compris à la casse.",
          },
          {
            title: "Push-out",
            body: "Après une casse légale, le tireur peut déclarer un push-out (pas d'obligation de bille basse / bande).",
          },
          {
            title: "Fautes",
            body: "Bille en main partout. 3 fautes consécutives → perte du rack. 9 illégale → re-spot.",
          },
        ],
      };
    case "US_TEN":
      return {
        heading: "Jeu de la 10",
        sections: [
          {
            title: "Règle",
            body: "Comme la 9, mais **annonce bille + poche** à chaque coup. 10 non annoncée / illégale → re-spot.",
          },
          {
            title: "Extras",
            body: "Push-out après casse légale ; 3 fautes consécutives → perte.",
          },
        ],
      };
    case "US_STRAIGHT_14_1":
      return {
        heading: "Jeu du 14/1",
        sections: [
          {
            title: "Règle",
            body: "Annoncer **bille + poche**. 1 point par pot légal (score d'équipe jusqu'à l'objectif).",
          },
          {
            title: "Fautes / re-rack",
            body: "Faute −1 (−2 à la casse) ; 3 fautes d'affilée −15. Quand 1 objet reste : re-rack des 14, laisser la 15ᵉ + blanche.",
          },
        ],
      };
    case "US_EIGHT":
    default:
      return {
        heading: "Jeu de la 8 (américain)",
        sections: [
          {
            title: "Équipes",
            body: "Deux équipes. Après la casse, table ouverte ; groupes (pleines / rayées) à la 1ʳᵉ bille légale empochée **après** la casse.",
          },
          {
            title: "But",
            body: "Clear son groupe puis la **8** annoncée (bille + poche).",
          },
          {
            title: "Casse",
            body: "Valide si pot **ou** ≥4 billes à la bande. 8 empochée à la casse → re-spot (pas de perte).",
          },
          {
            title: "Fautes",
            body: "Bille en main **partout** pour l'adversaire.",
          },
          {
            title: "Défaite",
            body: "8 trop tôt, mauvaise poche sur la 8, faute en potant la 8, 8 hors table.",
          },
        ],
      };
  }
}
