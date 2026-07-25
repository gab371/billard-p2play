import { useState } from "react";
import { usePeer as useCorePeer, type PeerManagerLike, type NetworkMessage } from "p2play-core";
import type { GameState, ShotFrame } from "../core/types";
import { soundManager } from "../core/soundFX";

interface UsePeerOptions {
  externalPeerManager?: PeerManagerLike<GameState>;
}

export function usePeer(options?: UsePeerOptions) {
  const [lastFrame, setLastFrame] = useState<ShotFrame | null>(null);

  const p2p = useCorePeer<GameState>({
    externalPeerManager: options?.externalPeerManager,
    namespacePrefix: "pool",
    sounds: {
      cue: (intensity) => soundManager.playCue(intensity ?? 1),
      clack: (intensity) => soundManager.playClack(intensity ?? 0.5),
      cushion: (intensity) => soundManager.playCushion(intensity ?? 0.5),
      pocket: () => soundManager.playPocket(),
      foul: () => soundManager.playFoul(),
      victory: () => soundManager.playVictory(),
      defeat: () => soundManager.playDefeat(),
      click: () => soundManager.playClick(),
      ping: () => soundManager.playPing(),
    },
    onCustomMessage: (msg: NetworkMessage) => {
      if (msg.type === "SHOT_FRAME") {
        const frame = (msg as { frame?: ShotFrame }).frame;
        if (frame) setLastFrame(frame);
      }
    },
  });

  return { ...p2p, lastFrame };
}
