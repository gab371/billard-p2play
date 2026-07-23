import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

export function mount(element: HTMLElement, options: {
  peerId: string;
  onExit?: () => void;
  externalPeerManager?: any;
  playerName?: string;
  playerAvatar?: string;
}) {
  const styleId = 'game-style-pool';
  if (!document.getElementById(styleId)) {
    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.href = './games/pool/style.css';
    document.head.appendChild(link);
  }

  const root = createRoot(element);
  root.render(
    <StrictMode>
      <App
        isEmbedded={true}
        externalPeerManager={options.externalPeerManager}
        onExit={options.onExit}
        playerName={options.playerName}
        playerAvatar={options.playerAvatar}
      />
    </StrictMode>
  );
  return () => root.unmount();
}

// Attach to window for dynamic runtime loads by the Hub.
(window as any).mountPool = mount;

const rootEl = document.getElementById('root');
if (rootEl && rootEl.children.length === 0) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
