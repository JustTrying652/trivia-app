const API_BASE = 'http://127.0.0.1:8000/api'

export async function createRoom() {
  const res = await fetch(`${API_BASE}/rooms/create/`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to create room')
  return res.json() // { room_code }
}

export async function checkRoom(roomCode) {
  const res = await fetch(`${API_BASE}/rooms/${roomCode}/`)
  if (res.status === 404) return { exists: false }
  if (!res.ok) throw new Error('Failed to check room')
  return res.json() // { exists, player_count, round_open }
}