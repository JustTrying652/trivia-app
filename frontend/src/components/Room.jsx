import { useRoomSocket } from '../hooks/useRoomSocket'
import Lobby from './Lobby'
import GameRound from './GameRound'
import GameOverScreen from './GameOverScreen'

export default function Room({ roomCode, nickname }) {
  const {
    connectionStatus,
    players,
    isHost,
    question,
    answerResult,
    roundResult,
    lastError,
    sendMessage,
  } = useRoomSocket(roomCode, nickname)

  const handleStartRound = () => sendMessage({ type: 'start_round' })
  const handleAnswer = (choice) => sendMessage({ type: 'answer', choice })

  if (roundResult?.game_over) {
    return <GameOverScreen scoreboard={roundResult.scoreboard} />
  }

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

  return (
    <GameRound
      question={question}
      answerResult={answerResult}
      roundResult={roundResult}
      isHost={isHost}
      onAnswer={handleAnswer}
      onNextRound={handleStartRound}
    />
  )
}