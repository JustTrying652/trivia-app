import { useRoomSocket } from '../hooks/useRoomSocket'
import Lobby from './Lobby'

export default function Room({ roomCode, nickname }) {
  const {
    connectionStatus,
    players,
    isHost,
    question,
    lastError,
    sendMessage,
  } = useRoomSocket(roomCode, nickname)

  const handleStartRound = () => sendMessage({ type: 'start_round' })

  // No active question yet → show the lobby. Once `question` is set, we'll
  // render the round screen here instead (next step).
  if (!question) {
    return (
      <Lobby
        roomCode={roomCode}
        connectionStatus={connectionStatus}
        players={players}
        isHost={isHost}
        lastError={lastError}
        onStartRound={handleStartRound}
      />
    )
  }

  return <p>Round screen goes here next.</p>
}