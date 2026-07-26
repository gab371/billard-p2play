import { P2PlayLobby } from "p2play-core";

const POOL_AVATARS = ["🎱", "🟠", "🟡", "🎯", "🤠", "👑", "🎩", "🎱"];

interface LobbyHomeProps {
  status: string;
  error: string | null;
  hostRoom: (name: string, avatar: string) => void;
  joinRoom: (name: string, avatar: string, roomId: string) => void;
}

/** Standalone home screen (create / join) via shared P2PlayLobby. */
export function LobbyHome({ status, error, hostRoom, joinRoom }: LobbyHomeProps) {
  return (
    <P2PlayLobby
      title="P2PLAY BILLARDS"
      subtitle="Billard par équipes en Peer-to-Peer"
      bannerEmoji="🎱"
      theme="amber"
      avatars={POOL_AVATARS}
      status={status}
      error={error}
      maxUsernameLength={14}
      showVoiceToggle={false}
      showCharacterCounter={false}
      subtitleTransform="none"
      usernameLabel="Pseudonyme"
      usernamePlaceholder="Entrez votre nom..."
      avatarLabel="Choisir un Avatar"
      createButtonText="Créer une Table"
      compactHostSection
      joinCodeLabel="Code de la table"
      joinCodePlaceholder="CODE"
      joinButtonText="Rejoindre"
      joinLayout="side-by-side"
      onHost={(username, avatar) => hostRoom(username, avatar)}
      onJoin={(username, avatar, roomCode) => joinRoom(username, avatar, roomCode)}
      classes={{
        root: "max-w-md mx-auto p-8 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl relative",
        header: "text-center mb-8",
        emoji: "text-5xl inline-block mb-3 animate-bounce",
        title: "text-4xl font-black bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent",
        subtitle: "text-zinc-400 text-sm mt-1",
        content: "space-y-5",
        label: "block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2",
        input: "w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 text-zinc-100 outline-none transition-all disabled:opacity-50",
        avatarGrid: "grid grid-cols-8 gap-2 bg-zinc-950 p-2.5 rounded-2xl border border-zinc-800/60",
        avatarItem: "text-2xl p-1.5 rounded-xl transition-all flex items-center justify-center aspect-square hover:bg-zinc-850",
        avatarItemSelected: "text-2xl p-1.5 rounded-xl transition-all flex items-center justify-center aspect-square bg-amber-500/20 border border-amber-500 scale-110",
        hr: "border-t border-zinc-800/60",
        actionGroup: "flex flex-col gap-3",
        createButton: "w-full py-3.5 px-6 rounded-2xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-white/5",
        divider: "relative flex py-2 items-center",
        dividerLine: "flex-grow border-t border-zinc-800/60",
        dividerText: "flex-shrink mx-4 text-zinc-500 text-xs font-bold uppercase tracking-widest",
        joinWrapper: "space-y-2",
        joinGroup: "flex gap-2",
        joinInput: "w-1/3 px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 focus:border-amber-500 text-zinc-100 text-center outline-none transition-all font-mono tracking-wider",
        joinButton: "flex-grow py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-zinc-950 font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/15",
        urlNotice: "p-5 bg-zinc-950 border border-zinc-800 rounded-2xl text-left flex flex-col gap-4",
        error: "text-rose-500 text-sm p-3 rounded-xl bg-rose-500/10 border border-rose-500/20",
      }}
    />
  );
}
