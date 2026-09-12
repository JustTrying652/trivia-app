export default function Lobby({ roomCode, connectionStatus, players, isHost, lastError, onStartRound }) {
  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <h1 style={styles.title}>Room {roomCode}</h1>
        <span style={styles.status}>{connectionStatus}</span>
      </header>

      {lastError && <p style={styles.error}>{lastError}</p>}

      <section>
        <h2 style={styles.subtitle}>Players ({players.length})</h2>
        <ul style={styles.list}>
          {players.map((p) => (
            <li key={p.player_id} style={styles.listItem}>
              {p.nickname}
              {!p.online && <span style={styles.offline}> (reconnecting…)</span>}
              {p.is_host && <span style={styles.badge}>host</span>}
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <button
          style={styles.startBtn}
          onClick={onStartRound}
          disabled={connectionStatus !== 'connected' || players.length < 1}
        >
          Start Round
        </button>
      ) : (
        <p style={styles.waiting}>Waiting for the host to start…</p>
      )}
    </div>
  )
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', gap: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: 0 },
  status: { color: 'var(--text-dim)', fontSize: '0.85rem', textTransform: 'lowercase' },
  subtitle: { fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-dim)' },
  list: { listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' },
  listItem: { background: 'var(--surface)', padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' },
  badge: { background: 'var(--gold)', color: 'var(--bg)', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' },
  offline: { color: 'var(--text-dim)', fontSize: '0.8rem' },
  startBtn: { padding: '16px', borderRadius: '10px', background: 'var(--green)', color: 'var(--bg)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '1.1rem' },
  waiting: { color: 'var(--text-dim)' },
  error: { color: 'var(--coral)' },
}