import type { LobbyProps } from "./lobbies/LobbyShared";
import { LobbyVariantB } from "./lobbies/LobbyVariantB";

export function Lobby(props: LobbyProps) {
  return <LobbyVariantB {...props} />;
}

export default Lobby;
