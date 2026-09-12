export default function GameOverScreen({ scoreboard }) {
  const [winner, ...rest] = scoreboard

  return (
    <div style={styles.wrap}>
      <div style={styles.trophy} aria-hidden="true" />
      <h1 style={styles.title}>Game over</h1>

      {winner && (
        <p style={styles.winner}>
          {winner.nickname} wins with {winner.score} points
        </p>
      )}

      <ol style={styles.list}>
        {scoreboard.map((p, i) => (
          <li key={p.nickname} style={styles.listItem}>
            <span style={styles.rank}>{i + 1}</span>
            <span style={styles.name}>{p.nickname}</span>
            <span style={styles.score}>{p.score}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: '16px' },
  trophy: { width: '64px', height: '64px', background: 'var(--gold)', transform: 'rotate(45deg)', borderRadius: '14px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '2.2rem', margin: 0 },
  winner: { color: 'var(--text-dim)', fontSize: '1.1rem', margin: 0 },
  list: { listStyle: 'none', padding: 0, width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '10px' },
  listItem: { display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface)', padding: '14px 16px', borderRadius: '10px' },
  rank: { fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-dim)', width: '20px' },
  name: { flex: 1, fontWeight: 600 },
  score: { fontFamily: 'var(--font-display)', fontWeight: 700 },
}