import { useState } from 'react'
import JoinScreen from './components/JoinScreen'
import Room from './components/Room'

function App() {
  const [session, setSession] = useState(null)

  if (!session) {
    return <JoinScreen onJoin={setSession} />
  }

  return <Room roomCode={session.roomCode} nickname={session.nickname} />
}

export default App