import { useState } from 'react'
import { useRoomSocket } from '../hooks/useRoomSocket'
import { setMuted, isMuted } from '../sound'
import Lobby from './Lobby'
import GameRound from './GameRound'
import GameOverScreen from './GameOverScreen'

export default function Room({ roomCode, nickname }) {
  const [muted, setMutedState] = useState(isMuted())

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

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  const muteButton = (
    <button
      onClick={toggleMute}
      style={{
        position: 'fixed', top: '16px', right: '16px', zIndex: 10,
        background: 'var(--surface)', color: 'var(--text)', border: 'none',
        borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer',
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )

  let content
  if (roundResult?.game_over) {
    content = <GameOverScreen scoreboard={roundResult.scoreboard} />
  } else if (!question) {
    content = (
      <Lobby
        roomCode={roomCode}
        connectionStatus={connectionStatus}
        players={players}
        isHost={isHost}
        lastError={lastError}
        onStartRound={handleStartRound}
      />
    )
  } else {
    content = (
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

  return (
    <>
      {muteButton}
      {content}
    </>
  )
}