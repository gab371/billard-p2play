import { useState } from "react";
import type { LobbyProps } from "./LobbyShared";
import { AvatarGrid, NameInput, RoomConnectedView } from "./LobbyShared";

/** Variant B — single screen styled like the other P2Play games (bouncing
 *  emote header, avatar grid, "Créer une Table" + "OU" + code + "Rejoindre"). */
export function LobbyVariantB(props: LobbyProps) {
  const { myPeerId, hostPeerId, isHost, players, status, error, isEmbedded, hostRoom, joinRoom, toggleReady, startGame, assignTeam, disconnect, onExit } = props;

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🎱");
  const [roomToJoin, setRoomToJoin] = useState("");
  const [loading, setLoading] = useState(false);

  if (myPeerId) {
    return <div className="flex items-center justify-center min-h-[70vh] px-4">
      <RoomConnectedView hostPeerId={hostPeerId} isHost={isHost} players={players} myPeerId={myPeerId} isEmbedded={isEmbedded}
        assignTeam={assignTeam} startGame={startGame} toggleReady={toggleReady} disconnect={disconnect} onExit={onExit} />
    </div>;
  }

  const handleHost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); hostRoom(name.trim(), avatar);
  };
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !roomToJoin.trim()) return;
    setLoading(true); joinRoom(name.trim(), avatar, roomToJoin.trim().toUpperCase());
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl relative">
      <div className="text-center mb-8">
        <span className="text-5xl inline-block mb-3 animate-bounce">🎱</span>
        <h1 className="text-4xl font-black bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">P2PLAY BILLARDS</h1>
        <p className="text-zinc-400 text-sm mt-1">Billard par équipes en Peer-to-Peer</p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Pseudonyme</label>
          <NameInput value={name} onChange={setName} disabled={loading} />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Choisir un Avatar</label>
          <AvatarGrid value={avatar} onChange={setAvatar} disabled={loading} />
        </div>

        {error && <div className="text-rose-500 text-sm p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">{error}</div>}

        <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800/60">
          <button onClick={handleHost} disabled={!name.trim() || loading}
            className="w-full py-3.5 px-6 rounded-2xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-white/5">
            {loading && status === "CONNECTING" ? "Création..." : "Créer une Table"}
          </button>
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-zinc-800/60" />
            <span className="flex-shrink mx-4 text-zinc-500 text-xs font-bold uppercase tracking-widest">OU</span>
            <div className="flex-grow border-t border-zinc-800/60" />
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="CODE" value={roomToJoin} onChange={(e) => setRoomToJoin(e.target.value.toUpperCase())} disabled={loading}
              className="w-1/3 px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 text-zinc-100 text-center outline-none transition-all font-mono tracking-wider" />
            <button onClick={handleJoin} disabled={!name.trim() || !roomToJoin.trim() || loading}
              className="flex-grow py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-zinc-950 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/15">
              Rejoindre
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LobbyVariantB;
