import { useEffect, useRef, useState, useCallback } from 'react'

export function useRoomSocket(roomCode, nickname) {
  const wsRef = useRef(null)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [players, setPlayers] = useState([])
  const [myPlayerId, setMyPlayerId] = useState(null)
  const [question, setQuestion] = useState(null)
  const [answerResult, setAnswerResult] = useState(null)
  const [roundResult, setRoundResult] = useState(null)
  const [lastError, setLastError] = useState(null)

  useEffect(() => {
    const storageKey = `trivia:player_id:${roomCode}`
    const storedPlayerId = sessionStorage.getItem(storageKey)

    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/room/${roomCode}/`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionStatus('connected')
      ws.send(JSON.stringify({
        type: 'join',
        nickname,
        player_id: storedPlayerId || undefined,
      }))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      console.log('[ws]', JSON.stringify(msg))   // temporary — remove once this is diagnosed

      switch (msg.type) {
        case 'joined':
          setMyPlayerId(msg.player_id)
          sessionStorage.setItem(storageKey, msg.player_id)
          break
        case 'player_list':
          setPlayers(msg.players)
          break
        case 'question_start':
          setQuestion(msg)
          setAnswerResult(null)
          setRoundResult(null)
          break
        case 'answer_result':
          setAnswerResult(msg)
          break
        case 'round_end':
          setRoundResult(msg)
          break
        case 'error':
          setLastError(msg.message)
          break
        default:
          break
      }
    }

    ws.onclose = () => setConnectionStatus('disconnected')
    ws.onerror = () => setConnectionStatus('error')

    return () => ws.close()
  }, [roomCode, nickname])

  const sendMessage = useCallback((data) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(data))
    return true
  }, [])

  const isHost = players.find((p) => p.player_id === myPlayerId)?.is_host ?? false

  return {
    connectionStatus,
    players,
    myPlayerId,
    isHost,
    question,
    answerResult,
    roundResult,
    lastError,
    sendMessage,
  }
}