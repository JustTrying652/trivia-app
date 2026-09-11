import { useState } from 'react'
import JoinScreen from './components/JoinScreen'

function App() {
  const [session, setSession] = useState(null) // { nickname, roomCode }

  if (!session) {
    return <JoinScreen onJoin={setSession} />
  }

  return (
    <div style={{ padding: 24 }}>
      <p>Joined as {session.nickname} in room {session.roomCode}</p>
      <p>(Lobby screen comes next)</p>
    </div>
  )
}

export default App