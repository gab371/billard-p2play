import type { GameConfig, Player, TeamId } from "../../core/types";
import type { VariantId, CaromMode } from "../../core/variants";
import { LobbyHome } from "./LobbyHome";
import { LobbyRoom } from "./LobbyRoom";

export interface LobbyProps {
  myPeerId: string | null;
  hostPeerId: string | null;
  isHost: boolean;
  players: Player[];
  spectatorLocks?: { [peerId: string]: boolean };
  status: string;
  error: string | null;
  isEmbedded?: boolean;
  variantId?: VariantId;
  caromMode?: CaromMode;
  hostRoom: (name: string, avatar: string) => void;
  joinRoom: (name: string, avatar: string, roomId: string) => void;
  toggleReady: (ready: boolean) => void;
  startGame: () => void;
  assignTeam: (playerId: string, team: TeamId | null) => void;
  onLockSpectator?: (peerId: string, locked: boolean) => void;
  onChangeConfig?: (config: Partial<GameConfig>) => void;
  disconnect: () => void;
  onExit?: () => void;
}

export function Lobby(props: LobbyProps) {
  const {
    myPeerId, hostPeerId, isHost, players, spectatorLocks, status, error,
    isEmbedded, variantId, caromMode, hostRoom, joinRoom, toggleReady, startGame,
    assignTeam, onLockSpectator, onChangeConfig, disconnect, onExit,
  } = props;

  if (myPeerId) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <LobbyRoom
          hostPeerId={hostPeerId}
          isHost={isHost}
          players={players}
          myPeerId={myPeerId}
          isEmbedded={isEmbedded}
          spectatorLocks={spectatorLocks}
          variantId={variantId}
          caromMode={caromMode}
          assignTeam={assignTeam}
          onLockSpectator={onLockSpectator}
          onChangeConfig={onChangeConfig}
          startGame={startGame}
          toggleReady={toggleReady}
          disconnect={disconnect}
          onExit={onExit}
        />
      </div>
    );
  }

  return (
    <LobbyHome
      status={status}
      error={error}
      hostRoom={hostRoom}
      joinRoom={joinRoom}
    />
  );
}

export default Lobby;
