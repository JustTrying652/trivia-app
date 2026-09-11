import { useState } from 'react'
import { createRoom, checkRoom } from '../api'

export default function JoinScreen({ onJoin }) {
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [mode, setMode] = useState('join') // 'join' | 'create'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!nickname.trim()) return setError('Enter a nickname first')
    setLoading(true)
    setError('')
    try {
      const { room_code } = await createRoom()
      onJoin({ nickname: nickname.trim(), roomCode: room_code })
    } catch {
      setError('Could not create a room. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!nickname.trim()) return setError('Enter a nickname first')
    if (!roomCode.trim()) return setError('Enter a room code')
    setLoading(true)
    setError('')
    try {
      const status = await checkRoom(roomCode.trim().toUpperCase())
      if (!status.exists) {
        setError("That room doesn't exist")
        return
      }
      onJoin({ nickname: nickname.trim(), roomCode: roomCode.trim().toUpperCase() })
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.shape} aria-hidden="true" />
      <h1 style={styles.title}>Trivia</h1>

      <input
        style={styles.input}
        placeholder="Your name"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={20}
      />

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(mode === 'join' ? styles.tabActive : {}) }}
          onClick={() => setMode('join')}
        >
          Join a room
        </button>
        <button
          style={{ ...styles.tab, ...(mode === 'create' ? styles.tabActive : {}) }}
          onClick={() => setMode('create')}
        >
          Create a room
        </button>
      </div>

      {mode === 'join' ? (
        <>
          <input
            style={styles.input}
            placeholder="Room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button style={styles.primaryBtn} onClick={handleJoin} disabled={loading}>
            {loading ? 'Joining...' : 'Join'}
          </button>
        </>
      ) : (
        <button style={styles.primaryBtn} onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating...' : 'Create room'}
        </button>
      )}

      {error && <p style={styles.error}>{error}</p>}
    </div>
  )
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '24px',
    position: 'relative',
  },
  shape: {
    position: 'absolute',
    top: '12%',
    right: '10%',
    width: '80px',
    height: '80px',
    background: 'var(--gold)',
    transform: 'rotate(45deg)',
    borderRadius: '12px',
    opacity: 0.9,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '3rem',
    fontWeight: 700,
    margin: 0,
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    maxWidth: '320px',
    padding: '14px 16px',
    fontSize: '1rem',
    borderRadius: '10px',
    border: '2px solid var(--surface)',
    background: 'var(--surface)',
    color: 'var(--text)',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    width: '100%',
    maxWidth: '320px',
  },
  tab: {
    flex: 1,
    padding: '10px',
    borderRadius: '10px',
    background: 'transparent',
    color: 'var(--text-dim)',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  tabActive: {
    background: 'var(--surface)',
    color: 'var(--text)',
  },
  primaryBtn: {
    width: '100%',
    maxWidth: '320px',
    padding: '16px',
    borderRadius: '10px',
    background: 'var(--coral)',
    color: 'var(--text)',
    fontWeight: 700,
    fontSize: '1.1rem',
    fontFamily: 'var(--font-display)',
  },
  error: {
    color: 'var(--coral)',
    fontSize: '0.9rem',
    margin: 0,
  },
}